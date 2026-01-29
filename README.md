# Shelvy Mobile App — Frontend

This React Native frontend uses Expo and connects to the Shelvy backend and Firebase for authentication.

Prerequisites
- Node.js (LTS recommended)
- npm (or Yarn)
- Expo CLI (optional): `npm install -g expo-cli`

Setup

1. Install dependencies:

```bash
npm install
```

2. Configure Firebase client

The app expects Firebase client config either in `app.json` under `expo.extra.firebaseConfig` or in the environment variable `EXPO_PUBLIC_FIREBASE_CONFIG` as a JSON string. Example `app.json` snippet:

```json
{
  "expo": {
    "extra": {
      "firebaseConfig": {
        "apiKey": "...",
        "authDomain": "...",
        "projectId": "...",
        "databaseURL": "...",
        "storageBucket": "...",
        "messagingSenderId": "...",
        "appId": "..."
      }
    }
  }
}
```

3. Run the app

Use the npm scripts in `package.json`:

```bash
npm start       # open Expo dev tools
npm run android # open on connected Android device/emulator
npm run ios     # open on iOS simulator (macOS only)
```

You can also run `npx expo start --tunnel` to allow a physical device to connect over the tunnel.

Notes
- The frontend signs in with a custom Firebase token issued by the backend. See `services/firebase.js` for where the client expects the Firebase config.
- If you see Git warnings about LF/CRLF on Windows, it's safe — Git will normalize line endings on commit.

Contributing
- Run `npm install` and open a PR against `geloace-test` or `main` per repo conventions.

License: MIT
