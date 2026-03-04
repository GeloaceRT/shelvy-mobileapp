const dotenv = require('dotenv');
import path from 'path';
import fs from 'fs';
import * as admin from 'firebase-admin';

dotenv.config();

const saEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const defaultSaPath = path.join(__dirname, '..', 'firebase-service-account.json');
const saPath = saEnv || defaultSaPath;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.log('Using GOOGLE_APPLICATION_CREDENTIALS:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
} else if (fs.existsSync(saPath)) {
  console.log('Using service account file:', saPath);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = saPath;
} else {
  console.error('No Firebase credentials found. Add a service account JSON to env-monitor-backend/firebase-service-account.json or set GOOGLE_APPLICATION_CREDENTIALS to its path.');
  console.error('See: https://console.firebase.google.com/ -> Project Settings -> Service Accounts -> Generate new private key');
  process.exit(1);
}

admin.initializeApp();
const db = admin.firestore();

async function main() {
  // Log project identifiers for diagnosis
  try {
    const sa = fs.existsSync(saPath) ? require(saPath) : null;
    console.log('serviceAccount.project_id:', sa?.project_id);
  } catch (e) {
    console.warn('Could not read service account JSON for project_id');
  }
  try {
    console.log('admin app projectId:', admin.app().options?.projectId);
  } catch (e) {
    console.warn('Could not read admin app projectId');
  }

  try {
    const ref = db.collection('test').doc('ping');
    await ref.set({ ts: admin.firestore.FieldValue.serverTimestamp(), ok: true });
    const snap = await ref.get();
    console.log('Firestore document data:', snap.data());
    process.exit(0);
  } catch (err) {
    console.warn('Firestore write failed, attempting Realtime Database fallback...');
    // Try Realtime Database using service account (if available) or common URL patterns
    const sa = fs.existsSync(saPath) ? require(saPath) : null;
    const projectId = sa?.project_id || process.env.FIREBASE_PROJECT_ID;
    const candidates = [] as string[];
    if (process.env.FIREBASE_DATABASE_URL) candidates.push(process.env.FIREBASE_DATABASE_URL);
    if (projectId) {
      candidates.push(`https://${projectId}.firebaseio.com`);
      candidates.push(`https://${projectId}-default-rtdb.asia-southeast1.firebasedatabase.app`);
    }

    let rtdbSuccess = false;
    for (const url of candidates) {
      if (!url) continue;
      console.log('Trying RTDB URL:', url);
      try {
        const appName = `rtdb-test-${Math.random().toString(36).slice(2,8)}`;
        const initOpts: any = { databaseURL: url };
        if (sa) initOpts.credential = admin.credential.cert(sa as admin.ServiceAccount);
        const tmpApp = admin.initializeApp(initOpts, appName);
        const rdb = tmpApp.database();
        const ref = rdb.ref('test/ping');
        await ref.set({ ts: Date.now(), ok: true });
        const snap = await ref.once('value');
        console.log('Realtime DB data:', snap.val());
        // cleanup
        tmpApp.delete().catch(() => {});
        rtdbSuccess = true;
        break;
      } catch (e) {
        console.warn('RTDB attempt failed for URL:', url, (e as any)?.message ?? e);
        // continue to next candidate
      }
    }

    if (!rtdbSuccess) {
      throw err; // rethrow original Firestore error if all RTDB attempts failed
    }
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test failed — full error:');
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
});
