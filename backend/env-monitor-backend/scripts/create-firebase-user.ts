import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import admin from 'firebase-admin';

dotenv.config();

const saEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const defaultSa = path.join(__dirname, '..', 'firebase-service-account.json');
const cwdSa = path.join(process.cwd(), 'firebase-service-account.json');

const candidates = [saEnv, defaultSa, cwdSa].filter(Boolean) as string[];
console.log('[firebase-script] Service account candidates:');
candidates.forEach((c) => console.log('  -', c, fs.existsSync(c) ? '(exists)' : '(missing)'));

let saPath: string | undefined = candidates.find((p) => fs.existsSync(p));
if (!saPath) {
  console.error('Service account JSON not found in any candidate paths. Place it at env-monitor-backend/firebase-service-account.json or set GOOGLE_APPLICATION_CREDENTIALS.');
  process.exit(1);
}

console.log('[firebase-script] Using service account JSON at:', saPath);
const serviceAccount = require(saPath);
const initOpts: any = { credential: admin.credential.cert(serviceAccount), projectId: serviceAccount.project_id };
if (process.env.FIREBASE_DATABASE_URL) initOpts.databaseURL = process.env.FIREBASE_DATABASE_URL;

admin.initializeApp(initOpts);
const auth = admin.auth();
const rdb = admin.database();

function usage() {
  console.log('Usage: npx tsx scripts/create-firebase-user.ts --email user@example.com --password Pass123 [--firstName Jane --lastName Doe]');
}

function parseArgs() {
  const args = process.argv.slice(2);
  const out: any = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--email') out.email = args[++i];
    else if (a === '--password') out.password = args[++i];
    else if (a === '--firstName') out.firstName = args[++i];
    else if (a === '--lastName') out.lastName = args[++i];
  }
  return out;
}

async function main() {
  const { email, password, firstName, lastName } = parseArgs();
  if (!email || !password) {
    usage();
    process.exit(1);
  }

    try {
      const userRecord = await auth.createUser({ email, password });
      console.log('Created Firebase user:', userRecord.uid);
      try {
        const createdAt = new Date().toISOString().slice(0, 10);
        await rdb.ref(`users/${userRecord.uid}`).set({ email, firstName, lastName, createdAt, source: 'script' });
        console.log('Wrote profile to Realtime DB under /users/' + userRecord.uid);
      } catch (e) {
        console.warn('Failed writing to RTDB:', (e as any)?.message ?? e);
      }
      process.exit(0);
    } catch (err: any) {
      console.error('Failed to create Firebase user:', err && err.message ? err.message : err);
      process.exit(1);
    }
}

main();
