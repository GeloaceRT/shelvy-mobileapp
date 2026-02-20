import Constants from 'expo-constants';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithCustomToken } from 'firebase/auth';

const cfg =
  Constants?.expoConfig?.extra?.firebaseConfig ?? process.env.EXPO_PUBLIC_FIREBASE_CONFIG ?? null;

let app;
if (cfg) {
  if (!getApps().length) {
    try {
      app = initializeApp(cfg);
    } catch (e) {
      console.warn('[firebase] initializeApp failed', e);
    }
  }
}

const auth = app ? getAuth(app) : null;

export async function signInWithCustomTokenAndGetIdToken(customToken) {
  if (!auth) throw new Error('Firebase client not configured. Fill expo.extra.firebaseConfig in app.json');
  const cred = await signInWithCustomToken(auth, customToken);
  const idToken = await cred.user.getIdToken();
  return idToken;
}

export default { signInWithCustomTokenAndGetIdToken };
