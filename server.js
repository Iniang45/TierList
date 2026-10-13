const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config();
const { MongoClient } = require("mongodb");

const PORT = Number(process.env.PORT || process.env.API_PORT || 3001);
// CORS requires an exact origin; remove any trailing slash from the Render env value.
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:5173")
  .trim()
  .replace(/\/+$/, "");
const DB_PATH = path.join(__dirname, "data", "db.json");
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "tierlist_studio";
const TOKENS = new Map();
const ADMIN_USER_ID = process.env.ADMIN_USER_ID;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
let mongoClient;
let mongoDb;

function sanitize(obj) {
  if (obj && typeof obj === "object") {
    for (const key in obj) {
      if (key.startsWith("$") || key.includes(".")) {
        delete obj[key]; // Supprime les opérateurs NoSQL malveillants
      } else {
        sanitize(obj[key]);
      }
    }
  }
  return obj;
}

function readLegacyDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) return null;
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  return {
    users: Array.isArray(db.users) ? db.users : [],
    tierlists: Array.isArray(db.tierlists) ? db.tierlists : [],
    friendRequests: Array.isArray(db.friendRequests) ? db.friendRequests : [],
    comments: Array.isArray(db.comments) ? db.comments : [],
  };
}

async function connectDatabase() {
  if (mongoDb) return mongoDb;
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI est obligatoire. Configurez l'URI de votre cluster MongoDB Atlas.",
    );
  }

  mongoClient = new MongoClient(MONGODB_URI);
  await mongoClient.connect();
  mongoDb = mongoClient.db(MONGODB_DB_NAME);

  const users = mongoDb.collection("users");
  const tierlists = mongoDb.collection("tierlists");
  const friendRequests = mongoDb.collection("friendRequests");
  const comments = mongoDb.collection("comments");
  await Promise.all([
    users.createIndex({ id: 1 }, { unique: true }),
    users.createIndex({ userId: 1 }, { unique: true }),
    tierlists.createIndex({ id: 1 }, { unique: true }),
    tierlists.createIndex({ ownerId: 1 }),
    friendRequests.createIndex({ id: 1 }, { unique: true }),
    friendRequests.createIndex({ toUserId: 1 }),
    comments.createIndex({ id: 1 }, { unique: true }),
    comments.createIndex({ tierlistId: 1, createdAt: 1 }),
  ]);

  const hasData =
    (await users.countDocuments()) > 0 ||
    (await tierlists.countDocuments()) > 0 ||
    (await friendRequests.countDocuments()) > 0 ||
    (await comments.countDocuments()) > 0;
  if (!hasData && process.env.MONGODB_MIGRATE_FILE !== "false") {
    const legacyDb = readLegacyDb();
    if (legacyDb) {
      if (legacyDb.users.length) await users.insertMany(legacyDb.users);
      if (legacyDb.tierlists.length) {
        await tierlists.insertMany(legacyDb.tierlists);
      }
      if (legacyDb.friendRequests.length) {
        await friendRequests.insertMany(legacyDb.friendRequests);
      }
      if (legacyDb.comments.length)
        await comments.insertMany(legacyDb.comments);
      console.log("Données locales migrées vers MongoDB Atlas.");
    }
  }

  const admin = await users.findOne({ userId: ADMIN_USER_ID });
  if (!admin) {
    await users.insertOne({
      id: createId("user"),
      userId: ADMIN_USER_ID,
      displayName: "Administrateur",
      passwordHash: hashPassword(ADMIN_PASSWORD),
      avatar: "",
      friends: [],
      role: "admin",
      createdAt: new Date().toISOString(),
    });
  } else if (admin.role !== "admin") {
    await users.updateOne(
      { _id: admin._id },
      { $set: { role: "admin", passwordHash: hashPassword(ADMIN_PASSWORD) } },
    );
  }

  await ensureAdminFriendships(
    users,
    admin || (await users.findOne({ userId: ADMIN_USER_ID })),
  );

  return mongoDb;
}

async function ensureAdminFriendships(usersCollection, admin) {
  if (!admin) return;
  const users = await usersCollection.find({}).toArray();
  const adminFriends = new Set(admin.friends || []);
  const operations = [];

  for (const user of users) {
    if (user.id === admin.id) continue;
    const userFriends = new Set(user.friends || []);
    if (!userFriends.has(admin.id)) {
      userFriends.add(admin.id);
      operations.push({
        updateOne: {
          filter: { _id: user._id },
          update: { $set: { friends: [...userFriends] } },
        },
      });
    }
    adminFriends.add(user.id);
  }

  if (adminFriends.size !== (admin.friends || []).length) {
    operations.push({
      updateOne: {
        filter: { _id: admin._id },
        update: { $set: { friends: [...adminFriends] } },
      },
    });
  }
  if (operations.length) await usersCollection.bulkWrite(operations);
}

async function syncCollection(collectionName, documents) {
  const collection = mongoDb.collection(collectionName);
  const ids = documents.map((document) => document.id);
  if (ids.length) {
    await collection.deleteMany({ id: { $nin: ids } });
  } else {
    await collection.deleteMany({});
  }
  for (const document of documents) {
    await collection.replaceOne({ id: document.id }, document, {
      upsert: true,
    });
  }
}

async function readDb() {
  await connectDatabase();
  const [users, tierlists, friendRequests, comments] = await Promise.all([
    await mongoDb.collection("users").find({}).toArray(),
    await mongoDb.collection("tierlists").find({}).toArray(),
    await mongoDb.collection("friendRequests").find({}).toArray(),
    await mongoDb
      .collection("comments")
      .find({})
      .sort({ createdAt: 1 })
      .toArray(),
  ]);
  return { users, tierlists, friendRequests, comments };
}

async function writeDb(db) {
  await connectDatabase();
  await Promise.all([
    await syncCollection("users", db.users),
    await syncCollection("tierlists", db.tierlists),
    await syncCollection("friendRequests", db.friendRequests),
    await syncCollection("comments", db.comments),
  ]);
}

function json(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": FRONTEND_URL,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    Vary: "Origin",
  });
  res.end(JSON.stringify(body));
}

function notFound(res) {
  json(res, 404, { error: "Not Found" });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 10 * 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(sanitize(JSON.parse(data)));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(String(password)).digest("hex");
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function createToken() {
  return crypto.randomUUID();
}

function getAuthUser(req, db) {
  const authorization = req.headers.authorization || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : null;
  const userId = token ? TOKENS.get(token) : null;
  if (!userId) {
    return null;
  }
  return db.users.find((user) => user.id === userId) || null;
}

function requireAdmin(req, db) {
  const user = getAuthUser(req, db);
  return user?.role === "admin" ? user : null;
}

function sanitizeUser(user, users = [], db = null) {
  if (!user) return null;
  const { _id, passwordHash, ...safe } = user;
  safe.friends = (user.friends || [])
    .map((friendId) => users.find((friend) => friend.id === friendId))
    .filter(Boolean)
    .map((friend) => {
      const {
        passwordHash: ignored,
        friends: ignoredFriends,
        ...friendData
      } = friend;
      return friendData;
    });
  if (db?.friendRequests) {
    safe.friendRequests = db.friendRequests
      .filter((request) => request.toUserId === user.id)
      .map((request) => ({
        ...request,
        from: sanitizeUser(
          users.find((candidate) => candidate.id === request.fromUserId),
          users,
        ),
      }));
    safe.sentFriendRequests = db.friendRequests
      .filter((request) => request.fromUserId === user.id)
      .map((request) => ({
        ...request,
        to: sanitizeUser(
          users.find((candidate) => candidate.id === request.toUserId),
          users,
        ),
      }));
  }
  return safe;
}

function sanitizeTierlist(tierlist, users) {
  const owner = users.find((user) => user.id === tierlist.ownerId) || null;
  const sourceItems = Array.isArray(tierlist.items) ? tierlist.items : [];
  const sourceImages = Array.isArray(tierlist.images) ? tierlist.images : [];
  const items = sourceItems.length > 0 ? sourceItems : sourceImages;
  const images = sourceImages.length > 0 ? sourceImages : sourceItems;
  const assets = [...items, ...images].filter(
    (image, index, list) =>
      image?.src &&
      list.findIndex((candidate) => candidate?.src === image.src) === index,
  );
  return {
    ...tierlist,
    items,
    images,
    assets,
    owner: owner
      ? {
          id: owner.id,
          userId: owner.userId,
          displayName: owner.displayName,
          avatar: owner.avatar,
        }
      : null,
  };
}

function sanitizeComment(comment, users) {
  const author = users.find((user) => user.id === comment.authorId);
  return {
    ...comment,
    author: author
      ? {
          id: author.id,
          userId: author.userId,
          displayName: author.displayName,
          avatar: author.avatar,
        }
      : null,
  };
}

function publicVisible(list) {
  return list.visibility === "public";
}

function collectAssets(body) {
  const candidates = [
    ...(Array.isArray(body.assets) ? body.assets : []),
    ...(Array.isArray(body.items) ? body.items : []),
    ...(Array.isArray(body.images) ? body.images : []),
  ];
  return candidates.filter(
    (image, index, list) =>
      image?.src &&
      list.findIndex((candidate) => candidate?.src === image.src) === index,
  );
}

function visibleToUser(list, user) {
  return (
    list.visibility === "public" ||
    (user && (list.ownerId === user.id || user.role === "admin"))
  );
}

async function serveDocs(res) {
  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TierList API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>body{margin:0;background:#0f172a} .swagger-ui .topbar{display:none}</style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
      });
    };
  </script>
</body>
</html>`;

  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

const openApi = {
  openapi: "3.0.3",
  info: {
    title: "TierList Community API",
    version: "1.0.0",
    description:
      "API REST locale pour auth, profils, amis et tierlists communautaires.",
  },
  servers: [{ url: "http://localhost:3001/api" }],
  paths: {
    "/auth/register": {
      post: {
        summary: "Créer un compte",
        requestBody: { required: true },
        responses: { 201: { description: "Compte créé" } },
      },
    },
    "/auth/login": {
      post: {
        summary: "Se connecter",
        requestBody: { required: true },
        responses: { 200: { description: "Connexion OK" } },
      },
    },
    "/me": {
      get: {
        summary: "Récupérer le compte connecté",
        responses: { 200: { description: "Utilisateur courant" } },
      },
    },
    "/tierlists": {
      get: { summary: "Lister les tierlists visibles" },
      post: { summary: "Créer une tierlist" },
    },
    "/tierlists/{id}": {
      get: { summary: "Détails d'une tierlist" },
      patch: { summary: "Modifier une tierlist" },
      delete: { summary: "Supprimer une tierlist" },
    },
    "/users/{id}/profile": {
      get: { summary: "Page publique d'un utilisateur" },
    },
  },
};

async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": FRONTEND_URL,
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      Vary: "Origin",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const db = await readDb();

  if (url.pathname === "/api/openapi.json" && req.method === "GET") {
    json(res, 200, openApi);
    return;
  }

  if (url.pathname === "/api/docs" && req.method === "GET") {
    await serveDocs(res);
    return;
  }

  if (url.pathname === "/api/health" && req.method === "GET") {
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/auth/register" && req.method === "POST") {
    const body = await readBody(req);
    const userId = String(body.userId || "").trim();
    const password = String(body.password || "");
    if (!userId || !password) {
      json(res, 400, { error: "userId et password requis" });
      return;
    }

    const existing = db.users.find(
      (user) => user.userId.toLowerCase() === userId.toLowerCase(),
    );
    if (existing) {
      json(res, 409, { error: "Cet identifiant existe déjà" });
      return;
    }

    const user = {
      id: createId("user"),
      userId,
      displayName: body.displayName || userId,
      passwordHash: hashPassword(password),
      avatar: body.avatar || "",
      friends: [],
      createdAt: new Date().toISOString(),
    };

    db.users.push(user);
    const admin = db.users.find((entry) => entry.userId === ADMIN_USER_ID);
    if (admin && user.id !== admin.id) {
      user.friends.push(admin.id);
      admin.friends = [...new Set([...(admin.friends || []), user.id])];
    }
    await writeDb(db);

    const token = createToken();
    TOKENS.set(token, user.id);
    json(res, 201, { token, user: sanitizeUser(user, db.users) });
    return;
  }

  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    const body = await readBody(req);
    const userId = String(body.userId || "").trim();
    const password = String(body.password || "");
    const user = db.users.find(
      (entry) => entry.userId.toLowerCase() === userId.toLowerCase(),
    );
    if (!user || user.passwordHash !== hashPassword(password)) {
      json(res, 401, { error: "Identifiants invalides" });
      return;
    }

    const token = createToken();
    TOKENS.set(token, user.id);
    json(res, 200, { token, user: sanitizeUser(user, db.users) });
    return;
  }

  if (url.pathname === "/api/me" && req.method === "GET") {
    const user = getAuthUser(req, db);
    if (!user) {
      json(res, 401, { error: "Non authentifié" });
      return;
    }
    json(res, 200, { user: sanitizeUser(user, db.users, db) });
    return;
  }

  if (url.pathname === "/api/admin/users" && req.method === "GET") {
    const admin = requireAdmin(req, db);
    if (!admin) {
      json(res, 403, { error: "Droits administrateur requis" });
      return;
    }
    json(res, 200, {
      users: db.users.map((user) => sanitizeUser(user, db.users)),
    });
    return;
  }

  if (url.pathname === "/api/admin/tierlists" && req.method === "GET") {
    const admin = requireAdmin(req, db);
    if (!admin) {
      json(res, 403, { error: "Droits administrateur requis" });
      return;
    }
    json(res, 200, {
      tierlists: db.tierlists.map((tierlist) =>
        sanitizeTierlist(tierlist, db.users),
      ),
    });
    return;
  }

  if (
    url.pathname.startsWith("/api/admin/tierlists/") &&
    req.method === "DELETE"
  ) {
    const admin = requireAdmin(req, db);
    if (!admin) {
      json(res, 403, { error: "Droits administrateur requis" });
      return;
    }
    const id = url.pathname.split("/").pop();
    const index = db.tierlists.findIndex((tierlist) => tierlist.id === id);
    if (index === -1) {
      json(res, 404, { error: "Tierlist introuvable" });
      return;
    }
    db.tierlists.splice(index, 1);
    await writeDb(db);
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname.startsWith("/api/admin/users/") && req.method === "DELETE") {
    const admin = requireAdmin(req, db);
    if (!admin) {
      json(res, 403, { error: "Droits administrateur requis" });
      return;
    }
    const id = url.pathname.split("/").pop();
    const target = db.users.find((user) => user.id === id);
    if (!target) {
      json(res, 404, { error: "Utilisateur introuvable" });
      return;
    }
    if (target.id === admin.id) {
      json(res, 400, {
        error: "Impossible de supprimer le compte admin actif",
      });
      return;
    }
    db.users = db.users.filter((user) => user.id !== id);
    db.users.forEach((user) => {
      user.friends = (user.friends || []).filter((friendId) => friendId !== id);
    });
    db.friendRequests = db.friendRequests.filter(
      (request) => request.fromUserId !== id && request.toUserId !== id,
    );
    db.tierlists = db.tierlists.filter((tierlist) => tierlist.ownerId !== id);
    await writeDb(db);
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/me" && req.method === "PATCH") {
    const user = getAuthUser(req, db);
    if (!user) {
      json(res, 401, { error: "Non authentifié" });
      return;
    }
    const body = await readBody(req);
    if (body.displayName !== undefined)
      user.displayName = String(body.displayName);
    if (body.avatar !== undefined) user.avatar = String(body.avatar);
    await writeDb(db);
    json(res, 200, { user: sanitizeUser(user, db.users, db) });
    return;
  }

  if (url.pathname === "/api/me/password" && req.method === "PATCH") {
    const user = getAuthUser(req, db);
    if (!user) {
      json(res, 401, { error: "Non authentifié" });
      return;
    }
    const body = await readBody(req);
    const currentPassword = String(body.currentPassword || "");
    const newPassword = String(body.newPassword || "");
    if (!currentPassword || !newPassword) {
      json(res, 400, { error: "Ancien et nouveau mot de passe requis" });
      return;
    }
    if (user.passwordHash !== hashPassword(currentPassword)) {
      json(res, 403, { error: "Ancien mot de passe incorrect" });
      return;
    }
    if (newPassword.length < 6) {
      json(res, 400, {
        error: "Le nouveau mot de passe doit contenir au moins 6 caractères",
      });
      return;
    }
    user.passwordHash = hashPassword(newPassword);
    await writeDb(db);
    json(res, 200, { user: sanitizeUser(user, db.users, db) });
    return;
  }

  if (url.pathname === "/api/friends" && req.method === "POST") {
    const user = getAuthUser(req, db);
    if (!user) {
      json(res, 401, { error: "Non authentifié" });
      return;
    }
    const body = await readBody(req);
    const friendId = String(body.friendId || "");
    const friend = db.users.find(
      (entry) => entry.id === friendId || entry.userId === friendId,
    );
    if (!friend) {
      json(res, 404, { error: "Utilisateur introuvable" });
      return;
    }
    if (friend.id === user.id) {
      json(res, 400, { error: "Impossible de s'ajouter soi-même" });
      return;
    }
    if (user.friends.includes(friend.id)) {
      json(res, 409, { error: "Vous êtes déjà amis" });
      return;
    }
    const existing = db.friendRequests.find(
      (request) =>
        request.fromUserId === user.id && request.toUserId === friend.id,
    );
    const reverse = db.friendRequests.find(
      (request) =>
        request.fromUserId === friend.id && request.toUserId === user.id,
    );
    if (existing || reverse) {
      json(res, 409, { error: "Une demande est déjà en cours" });
      return;
    }
    db.friendRequests.push({
      id: createId("friend_request"),
      fromUserId: user.id,
      toUserId: friend.id,
      createdAt: new Date().toISOString(),
    });
    await writeDb(db);
    json(res, 201, { user: sanitizeUser(user, db.users, db) });
    return;
  }

  if (
    url.pathname.startsWith("/api/friends/requests/") &&
    req.method === "POST"
  ) {
    const user = getAuthUser(req, db);
    if (!user) {
      json(res, 401, { error: "Non authentifié" });
      return;
    }
    const requestId = url.pathname.split("/").pop();
    const request = db.friendRequests.find(
      (entry) => entry.id === requestId && entry.toUserId === user.id,
    );
    if (!request) {
      json(res, 404, { error: "Demande introuvable" });
      return;
    }
    const sender = db.users.find((entry) => entry.id === request.fromUserId);
    if (!sender) {
      json(res, 404, { error: "Utilisateur introuvable" });
      return;
    }
    if (!user.friends.includes(sender.id)) user.friends.push(sender.id);
    if (!sender.friends.includes(user.id)) sender.friends.push(user.id);
    db.friendRequests = db.friendRequests.filter(
      (entry) => entry.id !== requestId,
    );
    await writeDb(db);
    json(res, 200, { user: sanitizeUser(user, db.users, db) });
    return;
  }

  if (
    url.pathname.startsWith("/api/friends/requests/") &&
    req.method === "DELETE"
  ) {
    const user = getAuthUser(req, db);
    if (!user) {
      json(res, 401, { error: "Non authentifié" });
      return;
    }
    const requestId = url.pathname.split("/").pop();
    const requestIndex = db.friendRequests.findIndex(
      (entry) =>
        entry.id === requestId &&
        (entry.toUserId === user.id || entry.fromUserId === user.id),
    );
    if (requestIndex === -1) {
      json(res, 404, { error: "Demande introuvable" });
      return;
    }
    db.friendRequests.splice(requestIndex, 1);
    await writeDb(db);
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname.startsWith("/api/friends/") && req.method === "DELETE") {
    const user = getAuthUser(req, db);
    if (!user) {
      json(res, 401, { error: "Non authentifié" });
      return;
    }
    const friendId = url.pathname.split("/").pop();
    const admin = db.users.find((entry) => entry.userId === ADMIN_USER_ID);
    if (admin && friendId === admin.id) {
      json(res, 400, { error: "L'administrateur reste dans votre réseau" });
      return;
    }
    user.friends = user.friends.filter((id) => id !== friendId);
    await writeDb(db);
    json(res, 200, { user: sanitizeUser(user, db.users) });
    return;
  }

  if (url.pathname === "/api/users/search" && req.method === "GET") {
    const q = String(url.searchParams.get("q") || "").toLowerCase();
    const users = db.users
      .filter(
        (user) =>
          !q ||
          user.userId.toLowerCase().includes(q) ||
          user.displayName.toLowerCase().includes(q),
      )
      .map((user) => sanitizeUser(user, db.users));
    json(res, 200, { users });
    return;
  }

  if (
    url.pathname.startsWith("/api/users/") &&
    url.pathname.endsWith("/profile") &&
    req.method === "GET"
  ) {
    const userId = url.pathname.split("/")[3];
    const target = db.users.find(
      (user) => user.id === userId || user.userId === userId,
    );
    if (!target) {
      json(res, 404, { error: "Utilisateur introuvable" });
      return;
    }
    const visibleTierlists = db.tierlists.filter(
      (tierlist) =>
        tierlist.ownerId === target.id && tierlist.visibility === "public",
    );
    json(res, 200, {
      user: sanitizeUser(target, db.users),
      createdTierlists: visibleTierlists.filter(
        (tierlist) => tierlist.type === "template",
      ),
      rankedTierlists: visibleTierlists.filter(
        (tierlist) => tierlist.type === "ranking",
      ),
    });
    return;
  }

  if (url.pathname === "/api/tierlists" && req.method === "GET") {
    const user = getAuthUser(req, db);
    const tierlists = db.tierlists
      .filter((tierlist) => visibleToUser(tierlist, user))
      .map((tierlist) => sanitizeTierlist(tierlist, db.users));
    json(res, 200, { tierlists });
    return;
  }

  if (url.pathname === "/api/tierlists/public" && req.method === "GET") {
    const user = getAuthUser(req, db);
    const tierlists = db.tierlists
      .filter(
        (tierlist) =>
          publicVisible(tierlist) &&
          (!user || tierlist.ownerId !== user.id) &&
          tierlist.type === "template",
      )
      .map((tierlist) => sanitizeTierlist(tierlist, db.users));
    json(res, 200, { tierlists });
    return;
  }

  if (url.pathname === "/api/tierlists/me" && req.method === "GET") {
    const user = getAuthUser(req, db);
    if (!user) {
      json(res, 401, { error: "Non authentifié" });
      return;
    }
    const tierlists = db.tierlists
      .filter((tierlist) => tierlist.ownerId === user.id)
      .map((tierlist) => sanitizeTierlist(tierlist, db.users));
    json(res, 200, { tierlists });
    return;
  }

  if (url.pathname === "/api/tierlists" && req.method === "POST") {
    const user = getAuthUser(req, db);
    if (!user) {
      json(res, 401, { error: "Non authentifié" });
      return;
    }
    const body = await readBody(req);
    const tierlist = {
      id: createId("tierlist"),
      ownerId: user.id,
      ownerType: user.userId,
      type: body.type || "template",
      originalTierlistId: body.originalTierlistId || null,
      name: body.name || "Sans titre",
      description: body.description || "",
      visibility: body.visibility === "public" ? "public" : "private",
      coverImage: body.coverImage || null,
      tiers: Array.isArray(body.tiers) ? body.tiers : [],
      images: Array.isArray(body.images) ? body.images : [],
      items: Array.isArray(body.items) ? body.items : [],
      assets: collectAssets(body),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.tierlists.push(tierlist);
    await writeDb(db);
    json(res, 201, { tierlist: sanitizeTierlist(tierlist, db.users) });
    return;
  }

  const commentMatch = url.pathname.match(
    /^\/api\/tierlists\/([^/]+)\/comments$/,
  );
  if (commentMatch && req.method === "GET") {
    const user = getAuthUser(req, db);
    const tierlist = db.tierlists.find((entry) => entry.id === commentMatch[1]);
    if (!tierlist || !visibleToUser(tierlist, user)) {
      json(res, 404, { error: "Tierlist introuvable" });
      return;
    }
    const comments = db.comments
      .filter((comment) => comment.tierlistId === tierlist.id)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map((comment) => sanitizeComment(comment, db.users));
    json(res, 200, { comments });
    return;
  }

  if (commentMatch && req.method === "POST") {
    const user = getAuthUser(req, db);
    if (!user) {
      json(res, 401, { error: "Connectez-vous pour commenter" });
      return;
    }
    const tierlist = db.tierlists.find((entry) => entry.id === commentMatch[1]);
    if (!tierlist || !visibleToUser(tierlist, user)) {
      json(res, 404, { error: "Tierlist introuvable" });
      return;
    }
    if (tierlist.type !== "ranking") {
      json(res, 400, {
        error: "Les commentaires sont disponibles sur les rankings",
      });
      return;
    }
    const body = await readBody(req);
    const text = String(body.text || "").trim();
    if (!text) {
      json(res, 400, { error: "Le commentaire ne peut pas être vide" });
      return;
    }
    if (text.length > 1000) {
      json(res, 400, { error: "Le commentaire est limité à 1000 caractères" });
      return;
    }
    const comment = {
      id: createId("comment"),
      tierlistId: tierlist.id,
      authorId: user.id,
      text,
      createdAt: new Date().toISOString(),
    };
    db.comments.push(comment);
    await writeDb(db);
    json(res, 201, { comment: sanitizeComment(comment, db.users) });
    return;
  }

  const commentDeleteMatch = url.pathname.match(
    /^\/api\/tierlists\/([^/]+)\/comments\/([^/]+)$/,
  );
  if (commentDeleteMatch && req.method === "DELETE") {
    const user = getAuthUser(req, db);
    if (!user) {
      json(res, 401, { error: "Non authentifié" });
      return;
    }
    const tierlist = db.tierlists.find(
      (entry) => entry.id === commentDeleteMatch[1],
    );
    const commentIndex = db.comments.findIndex(
      (comment) =>
        comment.id === commentDeleteMatch[2] &&
        comment.tierlistId === commentDeleteMatch[1],
    );
    if (!tierlist || commentIndex === -1) {
      json(res, 404, { error: "Commentaire introuvable" });
      return;
    }
    if (tierlist.ownerId !== user.id && user.role !== "admin") {
      json(res, 403, {
        error: "Seul le créateur ou l'admin peut supprimer ce commentaire",
      });
      return;
    }
    db.comments.splice(commentIndex, 1);
    await writeDb(db);
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname.startsWith("/api/tierlists/") && req.method === "GET") {
    const id = url.pathname.split("/").pop();
    const user = getAuthUser(req, db);
    const tierlist = db.tierlists.find((entry) => entry.id === id);
    if (!tierlist || !visibleToUser(tierlist, user)) {
      json(res, 404, { error: "Tierlist introuvable" });
      return;
    }
    json(res, 200, { tierlist: sanitizeTierlist(tierlist, db.users) });
    return;
  }

  if (url.pathname.startsWith("/api/tierlists/") && req.method === "PATCH") {
    const user = getAuthUser(req, db);
    if (!user) {
      json(res, 401, { error: "Non authentifié" });
      return;
    }
    const id = url.pathname.split("/").pop();
    const tierlist = db.tierlists.find((entry) => entry.id === id);
    if (!tierlist || (tierlist.ownerId !== user.id && user.role !== "admin")) {
      json(res, 404, { error: "Tierlist introuvable" });
      return;
    }
    const body = await readBody(req);
    Object.assign(tierlist, {
      name: body.name ?? tierlist.name,
      description: body.description ?? tierlist.description,
      visibility:
        body.visibility === "public" || body.visibility === "private"
          ? body.visibility
          : tierlist.visibility,
      coverImage: body.coverImage ?? tierlist.coverImage,
      tiers: Array.isArray(body.tiers) ? body.tiers : tierlist.tiers,
      images: Array.isArray(body.images) ? body.images : tierlist.images,
      items: Array.isArray(body.items) ? body.items : tierlist.items,
      assets: collectAssets({
        assets: body.assets ?? tierlist.assets,
        images: body.images ?? tierlist.images,
        items: body.items ?? tierlist.items,
      }),
      updatedAt: new Date().toISOString(),
    });
    await writeDb(db);
    json(res, 200, { tierlist: sanitizeTierlist(tierlist, db.users) });
    return;
  }

  if (url.pathname.startsWith("/api/tierlists/") && req.method === "DELETE") {
    const user = getAuthUser(req, db);
    if (!user) {
      json(res, 401, { error: "Non authentifié" });
      return;
    }
    const id = url.pathname.split("/").pop();
    const index = db.tierlists.findIndex((entry) =>
      user.role === "admin"
        ? entry.id === id
        : entry.id === id && entry.ownerId === user.id,
    );
    if (index === -1) {
      json(res, 404, { error: "Tierlist introuvable" });
      return;
    }
    db.tierlists.splice(index, 1);
    await writeDb(db);
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/public-feed" && req.method === "GET") {
    const user = getAuthUser(req, db);
    const admin = db.users.find((entry) => entry.userId === ADMIN_USER_ID);
    const friendIds = new Set(user?.friends || []);
    const visible = db.tierlists.filter((tierlist) => {
      if (tierlist.visibility !== "public" || user?.id === tierlist.ownerId) {
        return false;
      }

      if (tierlist.type === "template") {
        return true;
      }

      return Boolean(
        tierlist.ownerId === admin?.id ||
        (user && friendIds.has(tierlist.ownerId)),
      );
    });
    const tierlists = visible.map((tierlist) =>
      sanitizeTierlist(tierlist, db.users),
    );
    json(res, 200, {
      tierlists,
      createdTierlists: tierlists.filter(
        (tierlist) => tierlist.type === "template",
      ),
      rankedTierlists: tierlists.filter(
        (tierlist) => tierlist.type === "ranking",
      ),
    });
    return;
  }

  if (url.pathname === "/api/leaderboard" && req.method === "GET") {
    const tierlists = db.tierlists
      .filter(
        (tierlist) =>
          tierlist.visibility === "public" && tierlist.type === "ranking",
      )
      .map((tierlist) => sanitizeTierlist(tierlist, db.users));
    json(res, 200, { tierlists });
    return;
  }

  notFound(res);
}

const server = http.createServer((req, res) => {
  handler(req, res).catch((error) => {
    console.error(error);
    json(res, 500, { error: error.message || "Internal Server Error" });
  });
});

async function startServer() {
  // 1. Ouvrir le serveur HTTP immédiatement pour que Render valide le déploiement
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`TierList API running on port ${PORT}`);
  });

  // 2. Connecter MongoDB sans bloquer l'ouverture du port
  try {
    await connectDatabase();
    console.log(`MongoDB ${MONGODB_DB_NAME} connecté avec succès !`);
  } catch (err) {
    console.error("Erreur de connexion MongoDB :", err.message);
  }
}

startServer().catch((error) => {
  console.error(`Impossible de démarrer l'API : ${error.message}`);
  process.exitCode = 1;
});
