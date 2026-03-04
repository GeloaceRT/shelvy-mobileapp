import dotenv from 'dotenv';

dotenv.config();

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const config = {
  host: process.env.HOST?.trim() || '0.0.0.0',
  port: parseNumber(process.env.PORT, 3000),
  db: {
    url: process.env.DATABASE_URL || 'file:./dev.db',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    tokenExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  },
  sensor: {
    i2cAddress: Number(process.env.SENSOR_I2C_ADDRESS) || 0x44,
  },
  alert: {
    threshold: {
      temperature: Number(process.env.ALERT_TEMP_THRESHOLD) || 25,
      humidity: Number(process.env.ALERT_HUMIDITY_THRESHOLD) || 70,
    },
    testMode: process.env.ALERT_TEST_MODE === 'true',
  },
  serial: {
    port: process.env.ESP32_SERIAL_PORT?.trim() || '',
    baudRate: parseNumber(process.env.ESP32_SERIAL_BAUD, 115200),
    readTimeoutMs: parseNumber(process.env.ESP32_READ_TIMEOUT_MS, 2000),
  },
};

export default config;