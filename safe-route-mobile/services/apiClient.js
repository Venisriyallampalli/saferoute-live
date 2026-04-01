import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../utils/config';
import { AUTH_TOKEN_KEY, LEGACY_TOKEN_KEY } from '../utils/storageKeys';

async function getToken() {
  const primary = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  if (primary) return primary;

  return AsyncStorage.getItem(LEGACY_TOKEN_KEY);
}

export async function getAuthHeaders() {
  const token = await getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function apiRequest(endpoint, options = {}) {
  const headers = await getAuthHeaders();
  const url = `${API_BASE_URL}${endpoint}`;

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    const networkError = new Error('Network request failed');
    networkError.cause = error;
    networkError.url = url;
    throw networkError;
  }

  const rawText = await response.text();
  let data = {};

  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch (error) {
      data = { raw: rawText };
    }
  }

  if (!response.ok) {
    const message = data.message || data.error || 'Request failed';
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    error.url = url;
    throw error;
  }

  return data;
}

export async function apiRequestWithFallback(endpoint, options = {}, fallback = null) {
  try {
    return await apiRequest(endpoint, options);
  } catch (error) {
    if (typeof fallback === 'function') {
      return fallback(error);
    }

    if (fallback !== null) {
      return fallback;
    }

    throw error;
  }
}
