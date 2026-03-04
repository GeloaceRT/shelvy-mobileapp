import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';

const saEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const defaultSa = path.join(__dirname, '..', '..', 'firebase-service-account.json');

let initialized = false;
try {
  if (saEnv && fs.existsSync(saEnv)) {
    // Use explicit service account pointed by env var
    const serviceAccount = require(saEnv);
    const dbUrl = process.env.FIREBASE_DATABASE_URL;
    const initOpts: any = { credential: admin.credential.cert(serviceAccount as admin.ServiceAccount), projectId: serviceAccount.project_id };
    if (dbUrl) initOpts.databaseURL = dbUrl;
    admin.initializeApp(initOpts);
    initialized = true;
    console.log('Firebase initialized using GOOGLE_APPLICATION_CREDENTIALS');
    if (initOpts.databaseURL) console.log('Realtime DB URL:', initOpts.databaseURL);
  } else if (fs.existsSync(defaultSa)) {
    const serviceAccount = require(defaultSa);
    const dbUrl = process.env.FIREBASE_DATABASE_URL;
    const initOpts: any = { credential: admin.credential.cert(serviceAccount as admin.ServiceAccount), projectId: serviceAccount.project_id };
    if (dbUrl) initOpts.databaseURL = dbUrl;
    admin.initializeApp(initOpts);
    initialized = true;
    console.log('Firebase initialized using firebase-service-account.json');
    if (initOpts.databaseURL) console.log('Realtime DB URL:', initOpts.databaseURL);
  } else if (process.env.FIREBASE_PROJECT_ID) {
    // Allow ADC (e.g., when running on GCP) or when GOOGLE_APPLICATION_CREDENTIALS is set elsewhere
    const initOpts: any = {};
    if (process.env.FIREBASE_DATABASE_URL) initOpts.databaseURL = process.env.FIREBASE_DATABASE_URL;
    admin.initializeApp(initOpts);
    initialized = true;
    console.log('Firebase initialized using Application Default Credentials');
    if (initOpts.databaseURL) console.log('Realtime DB URL:', initOpts.databaseURL);
  }
} catch (err) {
  console.error('Failed to initialize Firebase Admin SDK:', err);
}

export const firebaseAdmin = admin;
export const firestore = initialized ? admin.firestore() : null;
export const realtimeDb = initialized ? admin.database() : null;
export const isFirebaseInitialized = initialized;

export default { firebaseAdmin, firestore, realtimeDb, isFirebaseInitialized };
