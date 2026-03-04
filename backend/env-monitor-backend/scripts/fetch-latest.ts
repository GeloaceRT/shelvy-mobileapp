import dotenv from 'dotenv';

dotenv.config();

const DEVICE_ID = process.argv[2] || process.env.DEVICE_ID || 'esp32-01';

async function main() {
  try {
    const mod = await import('../src/services/firebase.service');
    const firebaseService = mod.default;
    const readings = await firebaseService.listReadings(DEVICE_ID, 5);
    if (!readings || readings.length === 0) {
      console.log('No readings found for', DEVICE_ID);
      return;
    }
    const latest = readings[readings.length - 1];
    console.log('Latest reading for', DEVICE_ID, ':', latest);
  } catch (err) {
    console.error('Failed fetching latest reading:', (err as any)?.message ?? err);
  }
}

main();
