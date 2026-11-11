# RapidTier

Éditeur coloré pour créer des tierlists, avec drag & drop intuitif et export en image.

**Workflow principal :**

1. **Créer** → Définissez les tiers (S, A, B, …), ajoutez des images avec descriptions textuelles
2. **Ranger** → Chargez une tierlist et glissez les images dans les tiers, ou choisissez directement leur tier
3. **Commenter** → Consultez et ajoutez des commentaires sur les rankings visibles

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

Le serveur charge automatiquement les variables du fichier `.env` avec
`dotenv`. Ne committez jamais ce fichier.

Dans MongoDB Atlas, ajoutez l'adresse IP de la machine de déploiement dans
`Network Access` et créez un utilisateur de base de données dans `Database
Access`. N'intégrez jamais l'URI complète contenant le mot de passe dans Git.

`FRONTEND_URL` contrôle l'origine autorisée par le CORS. En production,
remplacez-la par l'URL publique exacte du frontend, par exemple
`https://mon-site.example`.

Le fichier `server.js` :

- crée le serveur HTTP et route les requêtes selon leur méthode et leur URL ;
- lit et écrit les collections `users`, `tierlists`, `friendRequests`, `comments` et `sessions` dans MongoDB Atlas ;
- hash les mots de passe avec SHA-256 avant de les stocker ;
- crée des sessions persistantes dans MongoDB et vérifie l'en-tête `Authorization` ;
- renvoie du JSON et active le CORS pour le frontend Vite.

### CORS

Le CORS est contrôlé par `FRONTEND_URL`. En local :

```env
FRONTEND_URL=http://localhost:5173
```

En production, indiquez l'URL exacte du frontend déployé. L'API ne permet pas
automatiquement toutes les origines.

Les sessions sont conservées dans la collection MongoDB `sessions`. Elles
expirent après 30 jours d'inactivité ; chaque requête authentifiée renouvelle
leur expiration pour 30 jours. Un redémarrage ou un redéploiement de l'API ne
déconnecte donc pas les utilisateurs dont la session est encore valide. La
déconnexion supprime la session, et un changement de mot de passe invalide les
sessions existantes.

Au premier démarrage sur une base MongoDB vide, le serveur migre automatiquement
`data/db.json` si le fichier existe. Cette migration peut être désactivée avec
`MONGODB_MIGRATE_FILE=false`. Après la migration, MongoDB Atlas devient la
source de vérité ; `data/db.json` n'est plus utilisé pour les nouvelles
écritures. Les tierlists invitées
restent temporaires dans le `sessionStorage` du navigateur.

### Sessions MongoDB

Au démarrage, l'API crée automatiquement les index nécessaires sur `sessions`,
dont un index TTL sur `expiresAt`. Aucune collection ou configuration manuelle
n'est nécessaire dans MongoDB Atlas. Après le premier déploiement de cette
version, les utilisateurs devront se reconnecter une fois afin d'obtenir un
nouveau token persistant ; les connexions suivantes survivront aux redémarrages
de Render.

## Permissions

- Un invité peut consulter les tierlists publiques, les rankings publics et les profils publics.
- Un compte connecté peut créer des tierlists, sauvegarder des rankings et commenter les rankings auxquels il a accès.
- Les commentaires peuvent être supprimés par le propriétaire du ranking ou par l'administrateur.
- Le compte administrateur utilise l'identifiant `ibra`. Ses droits sont vérifiés côté API avec le rôle `admin`.
- Les demandes d'amis nécessitent l'acceptation du destinataire.

## Fonctionnalités

- ✨ Design coloré avec séparation claire tier/éléments
- 🖼️ Support images illimitées avec texte affiché
- 🎯 Drag & drop fluide entre tiers
- 💬 Ajoutez des explications à chaque placement
- 💬 Ajoutez des commentaires sur les tierlists rangées visibles
- 👥 Envoyez, acceptez, refusez et supprimez des demandes d'amis
- 🛡️ Compte administrateur avec accès global aux profils et tierlists
- ⬇️ Export PNG de votre tierlist
- 👤 Mode invité avec sauvegarde temporaire dans `sessionStorage`
- 🔐 Sauvegarde des comptes et tierlists dans MongoDB Atlas
- 📱 Interface responsive

## Tech

React + Vite + Node.js HTTP + MongoDB Atlas + html2canvas + dotenv
