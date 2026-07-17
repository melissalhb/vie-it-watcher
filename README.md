# VIE IT Watcher

Envoie un email chaque matin avec les nouvelles offres VIE en informatique.

## Sources actuelles

- **Business France (mon-vie-via.businessfrance.fr)** — le site officiel du VIE.
  ⚠️ Ce site charge son contenu en JavaScript, je n'ai pas pu inspecter en direct
  ses appels réseau internes. Le scraper (`src/sources/businessFranceVie.js`)
  utilise une stratégie qui capture automatiquement les réponses JSON de la
  page plutôt que des sélecteurs figés — mais il faudra probablement l'ajuster
  ensemble au premier lancement (voir "Si aucune offre n'est trouvée" plus bas).
- **France Travail** — via leur API officielle, en cherchant les mots-clés
  "VIE informatique", "VIE développeur", etc. Fiable et déjà fonctionnel.

## Sources non incluses (pour l'instant)

- **LinkedIn** : scraper LinkedIn viole leurs conditions d'utilisation
  (risque de blocage de compte). Utilise plutôt leurs alertes email natives.
- **Indeed / Welcome to the Jungle** : pas de flux RSS/API public fiable
  trouvé au moment de la construction. On peut retenter plus tard.
- **APEC** : idem, à explorer si besoin.

Dis-moi si tu veux qu'on ajoute une de ces sources plus tard — on avancera
progressivement plutôt que de deviner leur structure sans pouvoir la tester.

## Mise en place (10-15 min)

### 1. Compte email — Resend
1. Crée un compte gratuit sur https://resend.com (100 emails/jour gratuits).
2. Récupère ta clé API (`re_...`).
3. Tu peux envoyer immédiatement depuis `onboarding@resend.dev` sans rien
   configurer de plus (limité à ton propre email de test au début, ce qui
   est parfait pour ton usage personnel).

### 2. Compte France Travail
1. Crée un compte sur https://francetravail.io
2. Crée une application, active l'API **"Offres d'emploi v2"**.
3. Récupère ton `Client ID` et `Client Secret`.

### 3. Dépôt GitHub
1. Crée un nouveau dépôt **privé** sur GitHub et pousse ce projet dedans :
   ```bash
   cd vie-it-watcher
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin <url-de-ton-repo>
   git push -u origin main
   ```
2. Dans **Settings > Secrets and variables > Actions**, ajoute ces secrets :
   - `RESEND_API_KEY`
   - `DIGEST_TO_EMAIL` (ton adresse email)
   - `DIGEST_FROM_EMAIL` (optionnel, sinon valeur par défaut utilisée)
   - `FT_CLIENT_ID`
   - `FT_CLIENT_SECRET`
3. Le workflow `.github/workflows/daily-digest.yml` tourne automatiquement
   chaque matin à 6h UTC (~7-8h Paris). Tu peux aussi le lancer manuellement
   depuis l'onglet **Actions > Digest quotidien VIE / IT > Run workflow**.

### 4. Tester en local (recommandé avant de tout automatiser)
```bash
npm install
npx playwright install --with-deps chromium
cp .env.example .env   # puis remplis tes vraies valeurs
node --env-file=.env src/index.js
```

## Si aucune offre Business France n'est trouvée

Lance en local avec le mode debug :
```bash
DEBUG_VIE=1 node --env-file=.env src/index.js
```
Ça va créer `data/debug-responses.json` avec toutes les réponses réseau
capturées sur le site. Envoie-moi ce fichier (ou juste les noms des clés
JSON) et j'ajuste le mapping des champs dans
`src/sources/businessFranceVie.js` en quelques minutes.

## Comment ça marche

- Chaque exécution récupère les offres des deux sources.
- On compare avec `data/seen.json` (les offres déjà envoyées).
- Seules les nouvelles offres sont envoyées par email, puis ajoutées à
  `data/seen.json` qui est re-committé automatiquement par le workflow.
- Pas de nouvelle offre → pas d'email (pas de spam le matin).
