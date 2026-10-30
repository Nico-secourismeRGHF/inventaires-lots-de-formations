# Registre d'inventaire — Lots PSC / STG (GitHub + Firebase)

Application web statique (HTML/JS) hébergée sur **Firebase Hosting**, avec stockage partagé dans **Firestore**,
connexion par **Firebase Authentication** (e-mail + mot de passe) et code source sur **GitHub**.

```
public/
  index.html          application
  firebase-config.js  à compléter avec VOTRE configuration Firebase
  firebase-shim.js    adaptateur Firebase (connexion, base de données, téléchargement PDF)
firebase.json         hébergement + règles
firestore.rules       règles d'accès (liste des e-mails autorisés à modifier)
.firebaserc           identifiant du projet
.github/workflows/    déploiement automatique à chaque push sur main
```

## 1. Créer le projet Firebase (console.firebase.google.com)
1. **Ajouter un projet** (le plan gratuit Spark suffit).
2. **Build > Firestore Database > Créer** (mode production, région européenne, ex. `eur3` ou `europe-west1`).
3. **Build > Authentication > Commencer > Adresse e-mail/Mot de passe** : activer.
   Puis **Utilisateurs > Ajouter un utilisateur** : créez un compte par personne qui saisit des inventaires.
   Si l'option existe (Paramètres > Actions utilisateur), désactivez « Activer la création (inscription) ».
4. **Paramètres du projet > Vos applications > Web (`</>`)** : enregistrez l'application et copiez la configuration
   dans `public/firebase-config.js`.
5. Dans `.firebaserc` et `.github/workflows/firebase-hosting.yml`, remplacez `VOTRE_ID_PROJET`.
6. Dans `firestore.rules`, listez les adresses e-mail autorisées (les mêmes que dans Authentication).

## 2. Déployer
```bash
npm install -g firebase-tools
firebase login
firebase deploy            # publie le site ET les règles Firestore
```
L'application est alors disponible sur `https://VOTRE_ID_PROJET.web.app`.

## 3. Mettre le code sur GitHub
```bash
git init && git add . && git commit -m "Registre d'inventaire PSC/STG"
git branch -M main
git remote add origin https://github.com/VOTRE_COMPTE/VOTRE_DEPOT.git
git push -u origin main
```
**Déploiement automatique (facultatif)** : le plus simple est de lancer `firebase init hosting:github` dans le dossier
(il crée le secret `FIREBASE_SERVICE_ACCOUNT` et configure le workflow). Sinon, créez ce secret à la main dans
GitHub > Settings > Secrets and variables > Actions. Chaque push sur `main` redéploie alors le site.
Les règles Firestore se déploient avec `firebase deploy --only firestore:rules`.

## 4. QR codes
Ouvrez l'onglet **QR codes** depuis l'adresse définitive (`https://VOTRE_ID_PROJET.web.app`) : les QR codes
pointent vers cette adresse (`?lot=P` ou `?lot=S`). Imprimez-les ensuite. La personne qui scanne se connecte
avec son compte, puis arrive directement sur le bon lot.

## À savoir
- Photos, formulaires et archives sont stockés dans Firestore (collections `records`, `archives`, `photos`).
- La clé `apiKey` de `firebase-config.js` n'est pas un secret : ce sont les règles Firestore qui protègent les données.
- La caméra exige HTTPS (fourni par Firebase Hosting).
- Les données saisies dans l'artefact claude.ai ne sont pas transférées automatiquement vers Firebase.
