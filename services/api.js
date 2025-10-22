import { Platform } from 'react-native';
import Constants from 'expo-constants';

const DEFAULT_PORT = 3000;

const trimTrailingSlash = (value) => value.replace(/\/$/, '');

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
      throw new Error(
        `Unable to reach the Shelvy backend at ${API_BASE_URL}. Confirm the server is running and accessible from this device.`
      );
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
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: email.trim(),
      password,
    }),
  });
}

export async function logout(token) {
  return request('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}