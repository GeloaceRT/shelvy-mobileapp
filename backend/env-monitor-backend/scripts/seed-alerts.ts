import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { pushAlert, listAlerts } from '../src/services/firebase.service';
import '../src/config/firebase';

dotenv.config();

const DEVICE_ID = process.env.DEVICE_ID || 'esp32-01';
const COUNT = Number(process.env.ALERT_COUNT || 3);

function buildSample(index: number) {
  const baseTs = Date.now() - index * 60_000; // 1 minute apart
  const severities: Array<'warning' | 'error' | 'info'> = ['warning', 'error', 'info'];
  const titles = ['Low humidity detected', 'Temperature spike', 'Device offline'];
  const values = ['Below threshold', 'Exceeded threshold', 'No ping received'];
  const severity = severities[index % severities.length];
  return {
    ts: baseTs,
    title: `${titles[index % titles.length]} (${DEVICE_ID})`,
    value: values[index % values.length],
    severity,
    deviceId: DEVICE_ID,
  };
}

async function main() {
  // ensure service account is present
  const saEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const defaultSa = path.join(__dirname, '..', 'firebase-service-account.json');
  if (!saEnv && !fs.existsSync(defaultSa)) {
    console.error('No Firebase credentials found. Set GOOGLE_APPLICATION_CREDENTIALS or add firebase-service-account.json.');
    process.exit(1);
  }

  const items = Array.from({ length: COUNT }).map((_, i) => buildSample(i));
  console.log(`Seeding ${items.length} alerts to alerts/${DEVICE_ID}...`);
  for (const item of items) {
    const key = await pushAlert(DEVICE_ID, item);
    console.log('  created', key, item.title);
  }

  const latest = await listAlerts(DEVICE_ID, 10);
  console.log('Latest alerts (up to 10):');
  latest.slice(-10).forEach((a) => {
    console.log(`- ${new Date(a.ts).toISOString()} [${a.severity}] ${a.title} :: ${a.value}`);
  });

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
