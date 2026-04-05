import { segmentRouteCoordinates } from './segmentService';
import { getSegmentWeatherRisk } from './weatherService';
import { getHazardRiskNearPoint } from './hazardService';

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function scoreToLabel(score) {
  if (score >= 80) return 'Safe';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Risky';
  return 'High Risk';
}

function isNight(now = new Date()) {
  const hour = now.getHours();
  return hour >= 18 || hour < 6;
}

function inferTrafficRisk(route, segment) {
  if (route?.trafficDensity !== undefined && route?.trafficDensity !== null) {
    return clamp01(Number(route.trafficDensity));
  }

  const avgSpeedMps = route?.durationSeconds > 0
    ? (route.distanceMeters || 0) / route.durationSeconds
    : 8;

  if (avgSpeedMps >= 17 || segment.length_m > 140) return 0.6;
  return 0.4;
}

function normalizeWeights(weights) {
  const sum = Object.values(weights).reduce((acc, value) => acc + value, 0);
  if (!sum) return weights;

  const normalized = {};
  Object.keys(weights).forEach((key) => {
    normalized[key] = weights[key] / sum;
  });

  return normalized;
}

function resolveActiveWeights({ hasTrafficData, hasWeatherData, hasHazardData }) {
  const base = {
    traffic: hasTrafficData ? 0.20 : 0.12,
    weather: hasWeatherData ? 0.15 : 0.08,
    hazard: hasHazardData ? 0.15 : 0.08,
    lighting: 0.15,
    time: 0.10,
  };

  return normalizeWeights(base);
}

function normalizeTransportMode(mode) {
  const normalized = String(mode || '').toLowerCase();
  if (['heavy', 'car', 'bike', 'cycle', 'walk'].includes(normalized)) {
    return normalized;
  }
  return 'car';
}

function getTransportRiskAdjustment(transportMode) {
  if (transportMode === 'heavy') return 0.03;
  if (transportMode === 'bike') return 0.015;
  if (transportMode === 'cycle') return -0.01;
  if (transportMode === 'walk') return -0.02;
  return 0;
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

function getFastHazardRisk(segment, route, night) {
  const seed = `${route?.id || route?.route_id || 'route'}:${segment.segment_id}`;
  const base = 0.08 + (night ? 0.03 : 0);
  return clamp01(base + (pseudoRandom01(seed) * 0.22));
}

async function resolveRouteWeatherRisk(segments, weatherApiKey) {
  if (!segments.length) return 0.2;
  const midpoint = segments[Math.floor(segments.length / 2)]?.midpoint;
  if (!midpoint) return 0.2;

  try {
    return await Promise.race([
      getSegmentWeatherRisk(midpoint, weatherApiKey),
      new Promise((resolve) => setTimeout(() => resolve(0.2), 2500)),
    ]);
  } catch (error) {
    return 0.2;
  }
}

export async function computeRouteSafetyLocally(route, options = {}) {
  const now = options.now instanceof Date ? options.now : new Date();
  const night = isNight(now);
  const hasTrafficData = route?.trafficDensity !== undefined && route?.trafficDensity !== null;
  const hasWeatherData = Boolean(options.weatherApiKey);
  const hasHazardData = true;
  const fastLocal = options.fastLocal !== false;
  const transportMode = normalizeTransportMode(route.transport_mode || route.transportMode || options.transportMode);
  const transportRiskAdjustment = getTransportRiskAdjustment(transportMode);

  const segments = segmentRouteCoordinates(route.coordinates, options.segmentLengthMeters || 75);
  if (!segments.length) {
    return {
      route_id: route.route_id || route.id || 'unknown-route',
      safety_score: 0,
      safety_label: 'High Risk',
      factors: {
        weather: 1,
        traffic: 1,
        hazard: 1,
        lighting: 1,
        transport_adjustment: transportRiskAdjustment,
      },
      transport_mode: transportMode,
      segments: [],
    };
  }

  let timeRisk = night ? 0.7 : 0.3;
  let lightingRisk = night ? 0.6 : 0.2;

  if (night) {
    timeRisk = Math.min(timeRisk, 0.55);
    lightingRisk = Math.min(lightingRisk, 0.45);
  }

  const weights = resolveActiveWeights({
    hasTrafficData,
    hasWeatherData,
    hasHazardData,
  });

  const totals = {
    segmentSafety: 0,
    weather: 0,
    traffic: 0,
    hazard: 0,
    lighting: 0,
    time: 0,
  };

  const routeWeatherRisk = fastLocal
    ? await resolveRouteWeatherRisk(segments, options.weatherApiKey)
    : null;

  const segmentResults = await Promise.all(segments.map(async (segment) => {
    const trafficRisk = inferTrafficRisk(route, segment);
    const weatherRisk = routeWeatherRisk != null
      ? routeWeatherRisk
      : await getSegmentWeatherRisk(segment.midpoint, options.weatherApiKey);

    const hazardRisk = fastLocal
      ? getFastHazardRisk(segment, route, night)
      : await getHazardRiskNearPoint(segment.midpoint, {
          fallbackSeed: `${route.id || route.route_id || 'route'}:${segment.segment_id}`,
          night,
        });

    const weightedRisk = clamp01(
      (weights.traffic * trafficRisk) +
      (weights.weather * weatherRisk) +
      (weights.hazard * hazardRisk) +
      (weights.lighting * lightingRisk) +
      (weights.time * timeRisk)
    );

    const favorableBonus =
      (weatherRisk <= 0.25 ? 0.05 : 0) +
      (hazardRisk <= 0.12 ? 0.04 : 0) +
      (trafficRisk <= 0.45 ? 0.04 : 0);

    const riskScore = clamp01((weightedRisk - favorableBonus) + transportRiskAdjustment);

    const segmentSafety = clamp01(1 - riskScore);

    return {
      segment_id: segment.segment_id,
      start: segment.start,
      end: segment.end,
      midpoint: segment.midpoint,
      risk_score: Number(riskScore.toFixed(3)),
      safety_score: Math.round(segmentSafety * 100),
      factors: {
        weather: Number(weatherRisk.toFixed(3)),
        traffic: Number(trafficRisk.toFixed(3)),
        hazard: Number(hazardRisk.toFixed(3)),
        lighting: Number(lightingRisk.toFixed(3)),
        time: Number(timeRisk.toFixed(3)),
        transport_adjustment: Number(transportRiskAdjustment.toFixed(3)),
      },
      __agg: {
        segmentSafety,
        weatherRisk,
        trafficRisk,
        hazardRisk,
        lightingRisk,
        timeRisk,
      },
    };
  }));

  const cleanedSegmentResults = segmentResults.map((segment) => {
    const agg = segment.__agg;
    totals.segmentSafety += agg.segmentSafety;
    totals.weather += agg.weatherRisk;
    totals.traffic += agg.trafficRisk;
    totals.hazard += agg.hazardRisk;
    totals.lighting += agg.lightingRisk;
    totals.time += agg.timeRisk;

    const { __agg, ...publicSegment } = segment;
    return publicSegment;
  });

  const segmentCount = segments.length;
  const routeSafetyScore = Math.round((totals.segmentSafety / segmentCount) * 100);

  return {
    route_id: route.route_id || route.id || 'unknown-route',
    safety_score: routeSafetyScore,
    safety_label: scoreToLabel(routeSafetyScore),
    transport_mode: transportMode,
    ml_features: {
      transport_mode: transportMode,
      avg_speed_mps: Number(((route?.durationSeconds > 0 ? (route.distanceMeters || 0) / route.durationSeconds : 0)).toFixed(2)),
      is_night: night,
    },
    factors: {
      weather: Number((totals.weather / segmentCount).toFixed(3)),
      traffic: Number((totals.traffic / segmentCount).toFixed(3)),
      hazard: Number((totals.hazard / segmentCount).toFixed(3)),
      lighting: Number((totals.lighting / segmentCount).toFixed(3)),
      time: Number((totals.time / segmentCount).toFixed(3)),
      transport_adjustment: Number(transportRiskAdjustment.toFixed(3)),
    },
    segment_count: segmentCount,
    segments: cleanedSegmentResults,
  };
}

export async function computeRoutesSafetyLocally(routes = [], options = {}) {
  const results = [];
  for (const route of routes) {
    // Keep local fallback deterministic-ish and time-aware while still varied per segment.
    // This is used only when backend scoring is unavailable.
    const scored = await computeRouteSafetyLocally(route, options);
    results.push(scored);
  }
  return results;
}
