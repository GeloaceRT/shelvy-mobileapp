import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { captureAndSave } from '../utils/screenshot';

const DEFAULT_PORT = 3001;
// Toggle this string to simulate client-side scenarios without hitting the backend.
// Supported values: 'none', 'no-data', 'stale', 'invalid-numeric', 'out-of-range'.
const SIMULATED_READING_SCENARIO = 'none';

const trimTrailingSlash = (value) => value.replace(/\/$/, '');

// Fallback device secret for secured ingest (align with backend DEVICE_SECRET)
export const DEFAULT_DEVICE_SECRET = process.env.EXPO_PUBLIC_DEVICE_SECRET || 'dev-device-secret-please-change';

const normaliseUrl = (value) =>
  value.startsWith('http') ? trimTrailingSlash(value) : `http://${trimTrailingSlash(value)}:${DEFAULT_PORT}`;

const pickFirstCandidate = (candidates) => {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return normaliseUrl(candidate.trim());
    }
  }
  return undefined;
};

function resolveBaseUrl() {
  const envUrl = pickFirstCandidate([
    process.env.EXPO_PUBLIC_API_BASE_URL,
    Constants?.expoConfig?.extra?.apiBaseUrl,
  ]);
  if (envUrl) {
    return envUrl;
  }

  const debuggerHost = Constants?.expoGoConfig?.debuggerHost ?? Constants?.expoConfig?.hostUri ?? '';
  if (debuggerHost) {
    const [host] = debuggerHost.split(':');
    if (Platform.OS === 'android' && (host === 'localhost' || host === '127.0.0.1')) {
      return normaliseUrl('10.0.2.2');
    }
    return normaliseUrl(host);
  }

  if (Platform.OS === 'android') {
    return normaliseUrl('10.0.2.2');
  }

  return normaliseUrl('127.0.0.1');
}

export const API_BASE_URL = resolveBaseUrl();

async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  } catch (error) {
    if (error instanceof TypeError && error.message === 'Network request failed') {
      try {
        // capture an on-device screenshot for evidence
        await captureAndSave('network-error');
      } catch (e) {
        console.warn('Screenshot capture failed', e);
      }
      throw new Error('Network disconnected. Please check your connection and try again.');
    }
    throw error instanceof Error ? error : new Error('Unexpected network error.');
  }

  const hasBody = response.status !== 204 && response.headers.get('Content-Length') !== '0';
  const contentType = response.headers.get('Content-Type') ?? '';
  const isJson = contentType.includes('application/json');
  const rawBody = hasBody ? await response.text() : '';

  if (!response.ok) {
    let message = '';

    if (isJson && rawBody) {
      try {
        const parsed = JSON.parse(rawBody);
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.message === 'string') {
            message = parsed.message;
          } else if (typeof parsed.error === 'string') {
            message = parsed.error;
          } else if (Array.isArray(parsed.errors) && typeof parsed.errors[0] === 'string') {
            message = parsed.errors[0];
          }
        }
      } catch {
        /* ignore parse errors so we can surface a generic message below */
      }
    }

    if (!message && rawBody) {
      message = rawBody.trim();
    }

    throw new Error(message || `Request failed (${response.status})`);
  }

  if (!rawBody) {
    return undefined;
  }

  if (!isJson) {
    return rawBody;
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error('Received malformed data from the server.');
  }
}

export async function login(email, password) {
  const res = await request('/api/auth/signin', {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim(),
      password,
    }),
  });
  // backend returns { firebaseToken, user }
  return { user: res?.user, token: res?.firebaseToken ?? res?.token };
}

export async function logout(token) {
  return request('/api/auth/signout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function fetchLatestReading(token) {
  const deviceId = 'esp32-01';

  if (SIMULATED_READING_SCENARIO && SIMULATED_READING_SCENARIO !== 'none') {
    const now = Date.now();
    const scenarios = {
      'no-data': null,
      stale: {
        temperature: 25.4,
        humidity: 61.2,
        capturedAt: new Date(now - 60_000).toISOString(),
      },
      'invalid-numeric': {
        temperature: 'NaN',
        humidity: 'oops',
        capturedAt: new Date(now).toISOString(),
      },
      'out-of-range': {
        temperature: 150,
        humidity: 140,
        capturedAt: new Date(now).toISOString(),
      },
    };

    if (Object.prototype.hasOwnProperty.call(scenarios, SIMULATED_READING_SCENARIO)) {
      return scenarios[SIMULATED_READING_SCENARIO];
    }
  }

  return request(`/api/readings/${deviceId}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function fetchLatestFromDb(token) {
  const deviceId = 'esp32-01';
  return request(`/api/readings/${deviceId}/latest`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function fetchReadingsHistory(token, limit = 3) {
  const deviceId = 'esp32-01';
  return request(`/api/readings/${deviceId}/history?limit=${Number(limit)}`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

// Fetch readings with optional device and date range (server must support from/to params)
export async function fetchReadingsRange({ deviceId = 'esp32-01', from, to, limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (from) params.set('from', new Date(from).toISOString());
  if (to) params.set('to', new Date(to).toISOString());
  return request(`/api/readings/${deviceId}/history?${params.toString()}`, { method: 'GET' });
}

export async function fetchAlertsRange({ deviceId = 'esp32-01', from, to, limit = 100 } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  if (from) params.set('from', new Date(from).toISOString());
  if (to) params.set('to', new Date(to).toISOString());
  return request(`/api/readings/${deviceId}/alerts/history?${params.toString()}`, { method: 'GET' });
}

export async function pushReading(deviceId, reading, deviceSecret) {
  return request(`/api/readings/${deviceId}`, {
    method: 'POST',
    headers: deviceSecret ? { 'x-device-secret': deviceSecret } : undefined,
    body: JSON.stringify(reading),
  });
}

export async function fetchDeviceSecret() {
  return request(`/api/config/device-secret`, { method: 'GET' });
}

export async function fetchReadingAlerts(token) {
  const deviceId = 'esp32-01';
  return request(`/api/readings/${deviceId}/alerts`, {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function fetchProfile(token) {
  return request('/api/users/me', {
    method: 'GET',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

export async function signup(firstName, lastName, email, password) {
  const res = await request('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({
      firstName: firstName?.trim?.() ?? '',
      lastName: lastName?.trim?.() ?? '',
      email: email?.trim?.(),
      password,
    }),
  });
  return { user: res?.user, token: res?.firebaseToken ?? res?.token };
}