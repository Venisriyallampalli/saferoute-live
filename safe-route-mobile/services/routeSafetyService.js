import { apiRequestWithFallback } from './apiClient';
import { WEATHER_API_KEY } from '../utils/config';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { computeRouteSafetyLocally as computeOneRouteSafetyLocally, computeRoutesSafetyLocally } from './safetyEngine';
import { HAZARD_LAST_UPDATED_KEY } from '../utils/storageKeys';

function withTimeout(promise, timeoutMs = 15000) {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Route scoring timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function getTimeBucket(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
}

export async function getDynamicRescoreKey() {
  const hazardUpdatedAt = (await AsyncStorage.getItem(HAZARD_LAST_UPDATED_KEY)) || 'none';
  return `${getTimeBucket()}|${hazardUpdatedAt}`;
}

export async function scoreRoutesWithBackend(routes, options = {}) {
  const payloadRoutes = (routes || []).map((route, index) => ({
    route_id: route.id || route.route_id || `route-${index}`,
    coordinates: route.coordinates,
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    trafficDensity: route.trafficDensity,
    transport_mode: route.transport_mode || route.transportMode || options.transportMode || 'car',
  }));

  if (!payloadRoutes.length) {
    return [];
  }

  const requestBody = {
    routes: payloadRoutes,
    segment_length_m: options.segmentLengthMeters || 100,
  };

  if (options.searchPolicy) {
    requestBody.search_policy = options.searchPolicy;
  }

  if (Number.isFinite(Number(options.maxExtraTimePercent))) {
    requestBody.max_extra_time_percent = Number(options.maxExtraTimePercent);
  }

  if (Number.isFinite(Number(options.minSafetyScore))) {
    requestBody.min_safety_score = Number(options.minSafetyScore);
  }

  if (options.roadTypePreference) {
    requestBody.road_type_preference = options.roadTypePreference;
  }

  if (WEATHER_API_KEY) {
    requestBody.weather_api_key = WEATHER_API_KEY;
  }

  try {
    const response = await withTimeout(
      apiRequestWithFallback('/api/safety/route-score', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      }),
      options.timeoutMs || 15000
    );

    if (Array.isArray(response?.routes) && response.routes.length) {
      return response.routes;
    }
  } catch (error) {
    // Fall through to local segment-wise scoring simulation.
  }

  try {
    return await computeRoutesSafetyLocally(payloadRoutes, {
      segmentLengthMeters: options.segmentLengthMeters || 75,
      weatherApiKey: WEATHER_API_KEY,
      now: options.now,
      fastLocal: true,
      transportMode: options.transportMode,
    });
  } catch (error) {
    return payloadRoutes.map((route, index) => {
      const base = Math.max(45, 82 - (index * 7));
      return {
        route_id: route.route_id,
        safety_score: base,
        safety_label: base >= 80 ? 'Safe' : base >= 60 ? 'Moderate' : base >= 40 ? 'Risky' : 'High Risk',
        transport_mode: route.transport_mode || 'car',
        factors: {
          weather: 0.3,
          traffic: 0.45,
          hazard: 0.2,
          accident: 0.25,
          crowd_presence: 0.25,
          protective: 0.25,
          lighting: 0.35,
          time: 0.35,
          transport_adjustment: 0,
        },
        segment_count: 0,
        segments: [],
      };
    });
  }
}

export async function computeRouteSafetyLocally(route, options = {}) {
  return computeOneRouteSafetyLocally(route, {
    segmentLengthMeters: options.segmentLengthMeters || 75,
    weatherApiKey: WEATHER_API_KEY,
    now: options.now,
  });
}

export function getScoreColor(score) {
  if (score >= 80) {
    return {
      chipBg: '#16a34a',
      chipText: '#ffffff',
      labelBg: '#dcfce7',
      labelText: '#166534',
    };
  }

  if (score >= 60) {
    return {
      chipBg: '#eab308',
      chipText: '#111827',
      labelBg: '#fef9c3',
      labelText: '#854d0e',
    };
  }

  return {
    chipBg: '#dc2626',
    chipText: '#ffffff',
    labelBg: '#fee2e2',
    labelText: '#991b1b',
  };
}

export function getSegmentColorBySafety(segmentSafetyScore) {
  const score = Number(segmentSafetyScore || 0);
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#eab308';
  return '#dc2626';
}
