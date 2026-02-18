# Absurd Music Player

Lit + Vite web app for encrypted music playback.

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Firebase deployment (bring your own project)

This repo is set up for Firebase Hosting, but each user should deploy to their own Firebase project.

1. Create a Firebase project in your own Google Cloud account.
2. Copy the template and set your project id:

```bash
cp .firebaserc.example .firebaserc
# edit .firebaserc and replace "your-firebase-project-id"
```

3. Authenticate and deploy:

```bash
npm run firebase:login
npm run firebase:use
npm run build
npm run deploy:hosting
```

Notes:
- `firebase.json` is shared and committed.
- `.firebaserc` is local-only and ignored by git.
- SPA routes are rewritten to `/index.html` by `firebase.json`.
