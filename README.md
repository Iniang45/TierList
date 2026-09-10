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
Express ni base de données externe. Elle écoute sur `http://localhost:3001` et
expose notamment `/api/auth`, `/api/me`, `/api/friends` et `/api/tierlists`.

Le fichier `server.js` :

- crée le serveur HTTP et route les requêtes selon leur méthode et leur URL ;
- lit et écrit les comptes et tierlists dans `data/db.json` ;
- hash les mots de passe avec SHA-256 avant de les stocker ;
- crée des tokens de session en mémoire et vérifie l'en-tête `Authorization` ;
- renvoie du JSON et active le CORS pour le frontend Vite.

Les comptes persistent après un redémarrage car `data/db.json` est un fichier
sur le disque du projet. En revanche, les tokens de session sont conservés
uniquement dans la mémoire de `server.js` : après un redémarrage de l'API, il
faut se reconnecter. Les tierlists invitées sont conservées dans le
`localStorage` du navigateur.

## Fonctionnalités

- ✨ Design coloré avec séparation claire tier/éléments
- 🖼️ Support images illimitées avec texte affiché
- 🎯 Drag & drop fluide entre tiers
- 💬 Ajoutez des explications à chaque placement
- ⬇️ Export PNG de votre tierlist
- 💾 Sauvegarde locale (localStorage)
- 📱 Interface responsive

## Tech

React + Vite + html2canvas
