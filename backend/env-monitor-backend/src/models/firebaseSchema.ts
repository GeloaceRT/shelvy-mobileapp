export type ProfileSource = 'signup' | 'script' | 'migration' | 'signup-existing';

export interface UserProfile {
  email: string;
  createdAt: string; // ISO date YYYY-MM-DD
  source: ProfileSource;
  serverId?: number;
  displayName?: string;
  firstName?: string;
  lastName?: string;
}

export interface SensorReading {
  sensorId: string;
  deviceId?: string;
  temperature?: number;
  humidity?: number;
  ts: number;
  date?: string; // YYYY-MM-DD
  meta?: Record<string, any>;
}

export interface ReadingsBucket {
  [key: string]: SensorReading;
}
