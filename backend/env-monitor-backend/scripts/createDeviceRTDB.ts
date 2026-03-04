import { realtimeDb, isFirebaseInitialized } from '../src/config/firebase';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

async function main() {
  if (!isFirebaseInitialized || !realtimeDb) {
    console.error('Firebase is not initialized. Set GOOGLE_APPLICATION_CREDENTIALS or provide firebase-service-account.json and FIREBASE_DATABASE_URL');
    process.exit(1);
  }

  const deviceId = process.argv[2] || 'esp32-01';
  const deviceSecret = process.argv[3] || crypto.randomBytes(16).toString('hex');
  const secretHash = await bcrypt.hash(deviceSecret, 12);

  const deviceRef = realtimeDb.ref(`devices/${deviceId}`);
  await deviceRef.set({
    deviceId,
    name: deviceId,
    secretHash,
    owner: null,
    createdAt: Date.now(),
  });

  console.log('Created device in Realtime DB:');
  console.log(`  deviceId: ${deviceId}`);
  console.log(`  deviceSecret (ONE-TIME): ${deviceSecret}`);
  console.log('Store this secret securely and flash it into the ESP32 for demo.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
