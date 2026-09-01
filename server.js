const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.API_PORT || 3001);
const DB_PATH = path.join(__dirname, "data", "db.json");
const TOKENS = new Map();

function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(DB_PATH)) {
    const seed = {
      users: [],
      tierlists: [],
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(seed, null, 2), "utf8");
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

function json(res, statusCode, body) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
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
        resolve(JSON.parse(data));
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

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function sanitizeTierlist(tierlist, users) {
  const owner = users.find((user) => user.id === tierlist.ownerId) || null;
  return {
    ...tierlist,
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

function publicVisible(list) {
  return list.visibility === "public";
}

function visibleToUser(list, user) {
  return list.visibility === "public" || (user && list.ownerId === user.id);
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
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    });
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const db = readDb();

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
    writeDb(db);

    const token = createToken();
    TOKENS.set(token, user.id);
    json(res, 201, { token, user: sanitizeUser(user) });
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
    json(res, 200, { token, user: sanitizeUser(user) });
    return;
  }

  if (url.pathname === "/api/me" && req.method === "GET") {
    const user = getAuthUser(req, db);
    if (!user) {
      json(res, 401, { error: "Non authentifié" });
      return;
    }
    json(res, 200, { user: sanitizeUser(user) });
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
    if (Array.isArray(body.friends)) user.friends = body.friends;
    writeDb(db);
    json(res, 200, { user: sanitizeUser(user) });
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
    if (!user.friends.includes(friend.id) && friend.id !== user.id) {
      user.friends.push(friend.id);
      writeDb(db);
    }
    json(res, 200, { user: sanitizeUser(user) });
    return;
  }

  if (url.pathname.startsWith("/api/friends/") && req.method === "DELETE") {
    const user = getAuthUser(req, db);
    if (!user) {
      json(res, 401, { error: "Non authentifié" });
      return;
    }
    const friendId = url.pathname.split("/").pop();
    user.friends = user.friends.filter((id) => id !== friendId);
    writeDb(db);
    json(res, 200, { user: sanitizeUser(user) });
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
      .map(sanitizeUser);
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
      user: sanitizeUser(target),
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    db.tierlists.push(tierlist);
    writeDb(db);
    json(res, 201, { tierlist: sanitizeTierlist(tierlist, db.users) });
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
    if (!tierlist || tierlist.ownerId !== user.id) {
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
      updatedAt: new Date().toISOString(),
    });
    writeDb(db);
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
    const index = db.tierlists.findIndex(
      (entry) => entry.id === id && entry.ownerId === user.id,
    );
    if (index === -1) {
      json(res, 404, { error: "Tierlist introuvable" });
      return;
    }
    db.tierlists.splice(index, 1);
    writeDb(db);
    json(res, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/public-feed" && req.method === "GET") {
    const user = getAuthUser(req, db);
    const tierlists = db.tierlists
      .filter(
        (tierlist) =>
          tierlist.visibility === "public" &&
          tierlist.type === "template" &&
          (!user || tierlist.ownerId !== user.id),
      )
      .map((tierlist) => sanitizeTierlist(tierlist, db.users));
    json(res, 200, { tierlists });
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

server.listen(PORT, () => {
  ensureDb();
  console.log(`TierList API running on http://localhost:${PORT}`);
});
