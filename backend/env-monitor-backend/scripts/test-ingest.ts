import dotenv from 'dotenv';

dotenv.config();

const API_BASE = process.env.API_BASE || 'http://localhost:4000';
const DEVICE_ID = process.env.DEVICE_ID || 'esp32-01';
const DEVICE_SECRET = process.env.DEVICE_SECRET || '';

async function postSingle() {
  const url = `${API_BASE}/api/readings/${DEVICE_ID}`;
  const reading = {
    ts: Date.now(),
    temperature: 24.5,
    humidity: 48.2,
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-secret': DEVICE_SECRET,
    },
    body: JSON.stringify(reading),
  });

  const data = await res.json().catch(() => ({}));
  console.log('Single POST status:', res.status, data);
}

async function postBatch() {
  const url = `${API_BASE}/api/readings/${DEVICE_ID}`;
  const readings = Array.from({ length: 3 }).map((_, i) => ({
    ts: Date.now() - i * 1000,
    temperature: 24 + i * 0.1,
    humidity: 47 + i * 0.5,
  }));

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-device-secret': DEVICE_SECRET,
    },
    body: JSON.stringify({ readings }),
  });

  const data = await res.json().catch(() => ({}));
  console.log('Batch POST status:', res.status, data);
}

async function main() {
  try {
    console.log('Posting single reading...');
    await postSingle();
    console.log('Posting batch readings...');
    await postBatch();
  } catch (err) {
    console.error('Error posting readings', err);
  }
}

main();
