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
  return hour >= 20 || hour < 6;
}

function inferRoadType(estimatedSpeedMetersPerSecond, segmentLengthMeters) {
  if (estimatedSpeedMetersPerSecond >= 20 || segmentLengthMeters >= 160) return 'highway';
  if (estimatedSpeedMetersPerSecond >= 10 || segmentLengthMeters >= 95) return 'arterial';
  return 'local';
}

function roadTypeRisk(roadType) {
  if (roadType === 'highway') return 0.8;
  if (roadType === 'arterial') return 0.55;
  return 0.35;
}

class RuleBasedSafetyScorer extends BaseSafetyScorer {
  scoreRoute(route, context = {}) {
    const now = context.now instanceof Date ? context.now : new Date();
    const night = isNightHour(now);

    const coordinates = Array.isArray(route.coordinates) ? route.coordinates : [];
    const segments = segmentRoute(coordinates, context.segmentLengthMeters || 100);

    if (segments.length === 0) {
      return {
        route_id: route.route_id || route.id || 'unknown-route',
        safety_score: 0,
        safety_label: 'High Risk',
        factors: {
          crime: 1,
          accident: 1,
          weather: 1,
          traffic: 1,
          hazard: 0.3,
        },
        segment_count: 0,
      };
    }

    const estimatedSpeedMetersPerSecond =
      route.durationSeconds > 0
        ? (route.distanceMeters || 0) / route.durationSeconds
        : 10;

    const weatherRisk = convertWeatherToRisk(context.weather || {});
    const timeOfDayFactor = night ? 0.85 : 0.25;
    const lightingCondition = night ? 0.8 : 0.25;
    const timeBucket = Math.floor(now.getTime() / (5 * 60 * 1000));

    const aggregate = {
      segmentScore: 0,
      crime: 0,
      accident: 0,
      weather: 0,
      traffic: 0,
      hazard: 0,
    };

    for (const segment of segments) {
      const locationSeed = `${segment.midpoint.latitude.toFixed(5)}:${segment.midpoint.longitude.toFixed(5)}:${segment.index}`;
      const locationRandom = pseudoRandom01(locationSeed);

      const locationType = locationRandom > 0.67 ? 'isolated' : 'urban';
      const isolatedRisk = locationType === 'isolated' ? 0.28 : 0.06;

      const crimeScore = clamp01(0.2 + (night ? 0.35 : 0.08) + isolatedRisk);

      const simulatedTraffic = clamp01(
        0.25 +
          (night ? 0.08 : 0.2) +
          pseudoRandom01(`${locationSeed}:traffic:${timeBucket}`) * 0.35
      );

      const trafficDensity = route.trafficDensity != null
        ? clamp01(Number(route.trafficDensity))
        : simulatedTraffic;

      const type = inferRoadType(estimatedSpeedMetersPerSecond, segment.lengthMeters);
      const accidentScore = clamp01((roadTypeRisk(type) * 0.6) + (trafficDensity * 0.4));

      const hazardScore = clamp(
        pseudoRandom01(`${locationSeed}:hazard:${timeBucket}`) * 0.3,
        0,
        0.3
      );

      const riskScore =
        (0.25 * crimeScore) +
        (0.20 * accidentScore) +
        (0.15 * weatherRisk) +
        (0.10 * trafficDensity) +
        (0.10 * hazardScore) +
        (0.10 * lightingCondition) +
        (0.10 * timeOfDayFactor);

      const segmentScore = clamp01(1 - riskScore);

      aggregate.segmentScore += segmentScore;
      aggregate.crime += crimeScore;
      aggregate.accident += accidentScore;
      aggregate.weather += weatherRisk;
      aggregate.traffic += trafficDensity;
      aggregate.hazard += hazardScore;
    }

    const avgSegmentScore = aggregate.segmentScore / segments.length;
    const safetyScore = Math.round(clamp(avgSegmentScore * 100, 0, 100));

    return {
      route_id: route.route_id || route.id || 'unknown-route',
      safety_score: safetyScore,
      safety_label: getSafetyLabel(safetyScore),
      factors: {
        crime: Number((aggregate.crime / segments.length).toFixed(3)),
        accident: Number((aggregate.accident / segments.length).toFixed(3)),
        weather: Number((aggregate.weather / segments.length).toFixed(3)),
        traffic: Number((aggregate.traffic / segments.length).toFixed(3)),
        hazard: Number((aggregate.hazard / segments.length).toFixed(3)),
      },
      segment_count: segments.length,
    };
  }
}

module.exports = {
  RuleBasedSafetyScorer,
  getSafetyLabel,
};
