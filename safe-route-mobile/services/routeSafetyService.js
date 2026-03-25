import { apiRequestWithFallback } from './apiClient';
import { WEATHER_API_KEY } from '../utils/config';

function fallbackScoreByIndex(index) {
  return Math.max(35, 88 - (index * 7));
}

function scoreToLabel(score) {
  if (score >= 80) return 'Safe';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Risky';
  return 'High Risk';
}

export async function scoreRoutesWithBackend(routes, options = {}) {
  const payloadRoutes = (routes || []).map((route) => ({
    route_id: route.id,
    coordinates: route.coordinates,
    distanceMeters: route.distanceMeters,
    durationSeconds: route.durationSeconds,
    trafficDensity: route.trafficDensity,
  }));

  if (!payloadRoutes.length) {
    return [];
  }

  const requestBody = {
    routes: payloadRoutes,
    segment_length_m: options.segmentLengthMeters || 100,
  };

  if (WEATHER_API_KEY) {
    requestBody.weather_api_key = WEATHER_API_KEY;
  }

  const fallback = {
    routes: payloadRoutes.map((route, idx) => {
      const score = fallbackScoreByIndex(idx);
      return {
        route_id: route.route_id,
        safety_score: score,
        safety_label: scoreToLabel(score),
        factors: {
          crime: 0.5,
          accident: 0.45,
          weather: 0.3,
          traffic: 0.5,
          hazard: 0.2,
        },
      };
    }),
  };

  const response = await apiRequestWithFallback(
    '/api/safety/route-score',
    {
      method: 'POST',
      body: JSON.stringify(requestBody),
    },
    fallback
  );

  return Array.isArray(response?.routes) ? response.routes : fallback.routes;
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
