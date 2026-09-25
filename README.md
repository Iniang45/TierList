# TierList Studio

Éditeur coloré pour créer des tierlists, avec drag & drop intuitif et export en image.

**Workflow en deux étapes :**

1. **Créer** → Définissez les tiers (S, A, B, …), ajoutez des images avec descriptions textuelles
2. **Ranger** → Chargez une tierlist et glissez les images dans les tiers, justifiez chaque placement

## Installation & Lancement

```bash
npm install
npm run dev
```

L'app s'ouvre à `http://localhost:5173/`

## Serveur et persistance

`npm run dev` lance `dev-server.js`. Ce fichier est un orchestrateur : il
démarre deux processus enfants, Vite pour le frontend (`npm run dev:client`)
et l'API Node (`npm run dev:api`).

L'API est implémentée directement avec le module natif `http` de Node.js, sans
Express. Elle écoute sur `http://localhost:3001` et expose notamment
`/api/auth`, `/api/me`, `/api/friends` et `/api/tierlists`.

La persistance utilise maintenant MongoDB Atlas via le package officiel
`mongodb`. Copiez `.env.example` vers `.env`, puis renseignez l'URI de votre
cluster :

```env
MONGODB_URI=mongodb+srv://utilisateur:mot_de_passe@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB_NAME=tierlist_studio
FRONTEND_URL=http://localhost:5173
```

Dans MongoDB Atlas, ajoutez l'adresse IP de la machine de déploiement dans
`Network Access` et créez un utilisateur de base de données dans `Database
Access`. N'intégrez jamais l'URI complète contenant le mot de passe dans Git.

`FRONTEND_URL` contrôle l'origine autorisée par le CORS. En production,
remplacez-la par l'URL publique exacte du frontend, par exemple
`https://mon-site.example`.

Le fichier `server.js` :

- crée le serveur HTTP et route les requêtes selon leur méthode et leur URL ;
- lit et écrit les collections `users`, `tierlists` et `friendRequests` dans MongoDB Atlas ;
- hash les mots de passe avec SHA-256 avant de les stocker ;
- crée des tokens de session en mémoire et vérifie l'en-tête `Authorization` ;
- renvoie du JSON et active le CORS pour le frontend Vite.

Au premier démarrage sur une base MongoDB vide, le serveur migre automatiquement
`data/db.json` si le fichier existe. Cette migration peut être désactivée avec
`MONGODB_MIGRATE_FILE=false`. Après la migration, MongoDB Atlas devient la
source de vérité ; `data/db.json` n'est plus utilisé pour les nouvelles
écritures. Les tokens de session restent en mémoire dans `server.js`, donc un
redémarrage de l'API demande une nouvelle connexion. Les tierlists invitées
restent temporaires dans le `sessionStorage` du navigateur.

## Fonctionnalités

- ✨ Design coloré avec séparation claire tier/éléments
- 🖼️ Support images illimitées avec texte affiché
- 🎯 Drag & drop fluide entre tiers
- 💬 Ajoutez des explications à chaque placement
- ⬇️ Export PNG de votre tierlist
- 💾 Sauvegarde locale (localStorage)
- 📱 Interface responsive

## Tech

React + Vite + Node.js HTTP + MongoDB Atlas + html2canvas
