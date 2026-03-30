import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequestWithFallback } from './apiClient';
import { HAZARD_REPORTS_KEY_PREFIX, HAZARD_LAST_UPDATED_KEY } from '../utils/storageKeys';

const hazardRiskCache = new Map();

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function pseudoRandom01(seed = '') {
  const text = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }

  return ((hash >>> 0) % 1000000) / 1000000;
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a, b) {
  const r = 6371000;
  const dLat = toRad((b.latitude || 0) - (a.latitude || 0));
  const dLon = toRad((b.longitude || 0) - (a.longitude || 0));
  const lat1 = toRad(a.latitude || 0);
  const lat2 = toRad(b.latitude || 0);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

function getHazardStorageKey(userId = 'anonymous') {
  return `${HAZARD_REPORTS_KEY_PREFIX}:${userId}`;
}

export async function loadHazardReports(userId = 'anonymous') {
  const key = getHazardStorageKey(userId);
  const local = await AsyncStorage.getItem(key);
  const localReports = local ? JSON.parse(local) : [];

  const remote = await apiRequestWithFallback('/api/safety/hazards', {}, { hazards: localReports });
  const hazards = Array.isArray(remote?.hazards) ? remote.hazards : localReports;

  await AsyncStorage.setItem(key, JSON.stringify(hazards));
  return hazards;
}

export async function submitHazardReport(userId = 'anonymous', report) {
  const key = getHazardStorageKey(userId);
  const local = await AsyncStorage.getItem(key);
  const previous = local ? JSON.parse(local) : [];

  const payload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: report.type,
    description: report.description || '',
    latitude: report.latitude,
    longitude: report.longitude,
    address: report.address || '',
    createdAt: new Date().toISOString(),
    source: 'mobile',
  };

  const next = [payload, ...previous];
  await AsyncStorage.setItem(key, JSON.stringify(next));
  await AsyncStorage.setItem(HAZARD_LAST_UPDATED_KEY, new Date().toISOString());

  await apiRequestWithFallback(
    '/api/safety/hazards',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    { success: true, hazard: payload }
  );

  return payload;
}

export async function getHazardRiskNearPoint(midpoint, options = {}) {
  if (!midpoint?.latitude || !midpoint?.longitude) {
    return 0.1;
  }

  const cacheKey = `${Number(midpoint.latitude).toFixed(2)}:${Number(midpoint.longitude).toFixed(2)}`;
  if (hazardRiskCache.has(cacheKey)) {
    return hazardRiskCache.get(cacheKey);
  }

  try {
    const response = await apiRequestWithFallback(
      `/api/safety/hazards?lat=${encodeURIComponent(midpoint.latitude)}&lng=${encodeURIComponent(midpoint.longitude)}&radius=350`,
      {},
      { hazards: [] }
    );

    const hazards = Array.isArray(response?.hazards) ? response.hazards : [];
    if (!hazards.length) {
      const randomBase = pseudoRandom01(options.fallbackSeed || `${midpoint.latitude}:${midpoint.longitude}`) * 0.3;
      const fallbackRisk = clamp01(randomBase + (options.night ? 0.03 : 0));
      hazardRiskCache.set(cacheKey, fallbackRisk);
      return fallbackRisk;
    }

    let risk = 0.08;
    hazards.forEach((hazard) => {
      const coords = hazard?.location?.coordinates || [];
      const point = {
        latitude: Number(coords[1] ?? hazard.latitude),
        longitude: Number(coords[0] ?? hazard.longitude),
      };

      if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
        return;
      }

      const meters = distanceMeters(midpoint, point);
      if (meters <= 80) {
        risk += 0.2;
      } else if (meters <= 150) {
        risk += 0.12;
      } else {
        risk += 0.06;
      }
    });

    const computed = clamp01(Math.min(risk, 0.9));
    hazardRiskCache.set(cacheKey, computed);
    return computed;
  } catch (error) {
    const randomBase = pseudoRandom01(options.fallbackSeed || `${midpoint.latitude}:${midpoint.longitude}`) * 0.3;
    const fallbackRisk = clamp01(randomBase + (options.night ? 0.03 : 0));
    hazardRiskCache.set(cacheKey, fallbackRisk);
    return fallbackRisk;
  }
}
