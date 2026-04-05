const BaseSafetyScorer = require('./baseScorer');
const { segmentRoute } = require('./segmenter');
const {
  clamp,
  clamp01,
  pseudoRandom01,
} = require('./helpers');
const { convertWeatherToRisk } = require('./weatherService');

function getSafetyLabel(score) {
  if (score >= 80) return 'Safe';
  if (score >= 60) return 'Moderate';
  if (score >= 40) return 'Risky';
  return 'High Risk';
}

function isNightHour(date) {
  const hour = date.getHours();
  return hour >= 18 || hour < 6;
}

function inferRoadType(estimatedSpeedMetersPerSecond, segmentLengthMeters) {
  if (estimatedSpeedMetersPerSecond >= 20 || segmentLengthMeters >= 160) return 'highway';
  if (estimatedSpeedMetersPerSecond >= 10 || segmentLengthMeters >= 95) return 'arterial';
  return 'local';
}

function roadTypeRisk(roadType) {
  if (roadType === 'highway') return 0.6;
  return 0.4;
}

function getTimeRisk(now) {
  return isNightHour(now) ? 0.7 : 0.3;
}

function getLightingRisk(now) {
  return isNightHour(now) ? 0.6 : 0.2;
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

function resolveActiveWeights({
  hasTrafficData,
  hasWeatherData,
  hasHazardData,
  hasAccidentData,
  hasCrowdData,
  hasProtectiveData,
}) {
  const base = {
    traffic: hasTrafficData ? 0.20 : 0.12,
    weather: hasWeatherData ? 0.15 : 0.08,
    hazard: hasHazardData ? 0.15 : 0.08,
    accident: hasAccidentData ? 0.22 : 0.12,
    crowd: hasCrowdData ? 0.12 : 0.05,
    protective: hasProtectiveData ? 0.12 : 0.05,
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

class RuleBasedSafetyScorer extends BaseSafetyScorer {
  async scoreRoute(route, context = {}) {
    const now = context.now instanceof Date ? context.now : new Date();
    const night = isNightHour(now);
    const hasTrafficData = route.trafficDensity != null;
    const hasWeatherData = Boolean(context.hasWeatherData);
    const hasHazardData = Boolean(context.hasHazardData);
    const hasAccidentData = Boolean(context.hasAccidentData);
    const hasCrowdData = Boolean(context.hasCrowdData);
    const hasProtectiveData = Boolean(context.hasProtectiveData);
    const transportMode = normalizeTransportMode(context.transportMode || route.transportMode || route.transport_mode);
    const transportRiskAdjustment = getTransportRiskAdjustment(transportMode);

    const coordinates = Array.isArray(route.coordinates) ? route.coordinates : [];
    const segments = segmentRoute(coordinates, context.segmentLengthMeters || 100);

    if (segments.length === 0) {
      return {
        route_id: route.route_id || route.id || 'unknown-route',
        safety_score: 0,
        safety_label: 'High Risk',
        factors: {
          weather: 1,
          traffic: 1,
          hazard: 1,
          accident: 1,
          crowd: 1,
          protective: 1,
          lighting: 1,
          time: 1,
          transport_adjustment: transportRiskAdjustment,
        },
        transport_mode: transportMode,
        segment_count: 0,
        segments: [],
      };
    }

    const estimatedSpeedMetersPerSecond =
      route.durationSeconds > 0
        ? (route.distanceMeters || 0) / route.durationSeconds
        : 10;

    let timeRisk = getTimeRisk(now);
    let lightingRisk = getLightingRisk(now);

    if (night) {
      timeRisk = Math.min(timeRisk, 0.55);
      lightingRisk = Math.min(lightingRisk, 0.45);
    }

    const weights = resolveActiveWeights({
      hasTrafficData,
      hasWeatherData,
      hasHazardData,
      hasAccidentData,
      hasCrowdData,
      hasProtectiveData,
    });

    const timeBucket = Math.floor(now.getTime() / (5 * 60 * 1000));

    const aggregate = {
      segmentSafety: 0,
      weather: 0,
      traffic: 0,
      hazard: 0,
      accident: 0,
      crowd: 0,
      protective: 0,
      lighting: 0,
      time: 0,
    };

    const segmentResults = await Promise.all(segments.map(async (segment) => {
      const locationSeed = `${segment.midpoint.latitude.toFixed(5)}:${segment.midpoint.longitude.toFixed(5)}:${segment.index}`;
      const locationRandom = pseudoRandom01(locationSeed);

      const locationType = locationRandom > 0.67 ? 'isolated' : 'urban';

      const simulatedTraffic = clamp01(
        0.25 +
          (night ? 0.08 : 0.2) +
          pseudoRandom01(`${locationSeed}:traffic:${timeBucket}`) * 0.35
      );

      const trafficDensity = route.trafficDensity != null
        ? clamp01(Number(route.trafficDensity))
        : simulatedTraffic;

      const type = inferRoadType(estimatedSpeedMetersPerSecond, segment.lengthMeters);
      const trafficRisk = clamp01((roadTypeRisk(type) * 0.5) + (trafficDensity * 0.5));

      let weatherRisk = convertWeatherToRisk(context.weather || {});
      if (typeof context.getWeatherRisk === 'function') {
        weatherRisk = clamp01(await context.getWeatherRisk(segment.midpoint));
      }

      let hazardScore = clamp(pseudoRandom01(`${locationSeed}:hazard:${timeBucket}`) * 0.2, 0, 0.2);
      if (typeof context.getHazardRisk === 'function') {
        hazardScore = clamp01(await context.getHazardRisk(segment.midpoint, { night, locationType, fallback: hazardScore }));
      }

      let accidentRisk = clamp(pseudoRandom01(`${locationSeed}:accident:${timeBucket}`) * 0.18, 0, 0.18);
      if (typeof context.getAccidentRisk === 'function') {
        accidentRisk = clamp01(await context.getAccidentRisk(segment.midpoint, {
          night,
          locationType,
          roadType: type,
          fallback: accidentRisk,
        }));
      }

      let crowdRisk = clamp(pseudoRandom01(`${locationSeed}:crowd:${timeBucket}`) * 0.2, 0, 0.2);
      if (typeof context.getCrowdRisk === 'function') {
        crowdRisk = clamp01(await context.getCrowdRisk(segment.midpoint, {
          night,
          fallback: crowdRisk,
        }));
      }

      let protectiveScore = clamp(pseudoRandom01(`${locationSeed}:protective:${timeBucket}`) * 0.35, 0, 0.35);
      if (typeof context.getProtectiveScore === 'function') {
        protectiveScore = clamp01(await context.getProtectiveScore(segment.midpoint, {
          night,
          fallback: protectiveScore,
        }));
      }
      const protectiveRisk = clamp01(1 - protectiveScore);

      const weightedRisk =
        (weights.traffic * trafficRisk) +
        (weights.weather * weatherRisk) +
        (weights.hazard * hazardScore) +
        (weights.accident * accidentRisk) +
        (weights.crowd * crowdRisk) +
        (weights.protective * protectiveRisk) +
        (weights.lighting * lightingRisk) +
        (weights.time * timeRisk);

      const favorableBonus =
        (weatherRisk <= 0.25 ? 0.05 : 0) +
        (hazardScore <= 0.12 ? 0.04 : 0) +
        (trafficRisk <= 0.45 ? 0.04 : 0);

      const riskScore = clamp01((weightedRisk - favorableBonus) + transportRiskAdjustment);

      const segmentSafety = clamp01(1 - riskScore);

      return {
        segment_id: segment.segment_id,
        start: segment.start,
        end: segment.end,
        midpoint: segment.midpoint,
        safety_score: Math.round(segmentSafety * 100),
        risk_score: Number(riskScore.toFixed(3)),
        __agg: {
          segmentSafety,
          weatherRisk,
          trafficRisk,
          hazardScore,
          accidentRisk,
          crowdRisk,
          protectiveScore,
          lightingRisk,
          timeRisk,
        },
        factors: {
          weather: Number(weatherRisk.toFixed(3)),
          traffic: Number(trafficRisk.toFixed(3)),
          hazard: Number(hazardScore.toFixed(3)),
          accident: Number(accidentRisk.toFixed(3)),
          crowd_presence: Number(crowdRisk.toFixed(3)),
          protective: Number(protectiveScore.toFixed(3)),
          lighting: Number(lightingRisk.toFixed(3)),
          time: Number(timeRisk.toFixed(3)),
          transport_adjustment: Number(transportRiskAdjustment.toFixed(3)),
        },
      };
    }));

    const cleanedSegmentResults = segmentResults.map((segment) => {
      const agg = segment.__agg;
      aggregate.segmentSafety += agg.segmentSafety;
      aggregate.weather += agg.weatherRisk;
      aggregate.traffic += agg.trafficRisk;
      aggregate.hazard += agg.hazardScore;
      aggregate.accident += agg.accidentRisk;
      aggregate.crowd += agg.crowdRisk;
      aggregate.protective += agg.protectiveScore;
      aggregate.lighting += agg.lightingRisk;
      aggregate.time += agg.timeRisk;

      const { __agg, ...publicSegment } = segment;
      return publicSegment;
    });

    const avgSegmentSafety = aggregate.segmentSafety / segments.length;
    const safetyScore = Math.round(clamp(avgSegmentSafety * 100, 0, 100));

    return {
      route_id: route.route_id || route.id || 'unknown-route',
      safety_score: safetyScore,
      safety_label: getSafetyLabel(safetyScore),
      transport_mode: transportMode,
      ml_features: {
        transport_mode: transportMode,
        avg_speed_mps: Number(estimatedSpeedMetersPerSecond.toFixed(2)),
        is_night: night,
      },
      factors: {
        weather: Number((aggregate.weather / segments.length).toFixed(3)),
        traffic: Number((aggregate.traffic / segments.length).toFixed(3)),
        hazard: Number((aggregate.hazard / segments.length).toFixed(3)),
        accident: Number((aggregate.accident / segments.length).toFixed(3)),
        crowd_presence: Number((aggregate.crowd / segments.length).toFixed(3)),
        protective: Number((aggregate.protective / segments.length).toFixed(3)),
        lighting: Number((aggregate.lighting / segments.length).toFixed(3)),
        time: Number((aggregate.time / segments.length).toFixed(3)),
        transport_adjustment: Number(transportRiskAdjustment.toFixed(3)),
      },
      segment_count: segments.length,
      segments: cleanedSegmentResults,
    };
  }
}

module.exports = {
  RuleBasedSafetyScorer,
  getSafetyLabel,
};
