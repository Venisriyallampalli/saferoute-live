const { clamp01, haversineDistanceMeters } = require('./helpers');

const DEFAULT_WEIGHTS = {
  count: 0.25,
  severity: 0.30,
  night: 0.15,
  vulnerable: 0.10,
  recent: 0.20,
};

function normalizeString(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeRoadType(roadType = '') {
  const value = normalizeString(roadType);
  if (!value) return 'unknown';
  if (value.includes('major') || value.includes('highway') || value.includes('nh') || value.includes('orrr')) {
    return 'highway';
  }
  if (value.includes('service') || value.includes('arterial') || value.includes('main')) {
    return 'arterial';
  }
  if (value.includes('other') || value.includes('local') || value.includes('street')) {
    return 'local';
  }
  return 'unknown';
}

function mapAccidentSeverityToRisk(severity = '') {
  const value = normalizeString(severity);
  if (value.includes('fatal')) return 1.0;
  if (value.includes('grievous') || value.includes('major')) return 0.75;
  if (value.includes('minor')) return 0.45;
  if (value.includes('non') && value.includes('injury')) return 0.18;
  return 0.35;
}

function mapVehicleVulnerability(vehicleType = '') {
  const value = normalizeString(vehicleType);
  if (!value) return 0.2;
  if (value.includes('pedestrian')) return 1.0;
  if (value.includes('motor cycle') || value.includes('bike') || value.includes('cycle') || value.includes('scooter')) {
    return 0.8;
  }
  if (value.includes('auto')) return 0.55;
  if (value.includes('bus') || value.includes('lorry') || value.includes('truck')) return 0.45;
  return 0.3;
}

function parseHourFromWindow(timeWindow = '') {
  const value = normalizeString(timeWindow);
  if (!value) return null;
  const match = value.match(/(\d{3,4})\s*to\s*(\d{3,4})/);
  if (!match) return null;

  const start = Number(match[1].slice(0, 2));
  const endRaw = Number(match[2].slice(0, 2));
  const end = endRaw === 0 ? 24 : endRaw;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;

  if (start < end) return Math.floor((start + end) / 2);
  const wrappedEnd = end + 24;
  const mid = Math.floor((start + wrappedEnd) / 2);
  return mid % 24;
}

function toHourBin(hour) {
  if (!Number.isFinite(hour)) return null;
  const safeHour = Math.max(0, Math.min(23, Math.floor(hour)));
  const start = Math.floor(safeHour / 3) * 3;
  const end = (start + 3) % 24;
  const startText = `${String(start).padStart(2, '0')}00`;
  const endText = `${String(end).padStart(2, '0')}00`;
  return `${startText}-${endText}`;
}

function isNightHour(hour) {
  if (!Number.isFinite(hour)) return false;
  return hour >= 18 || hour < 6;
}

function getTimeWindowOverlapWeight(eventTimeWindow = '', targetHour = null) {
  if (!Number.isFinite(targetHour)) return 1;
  const windowText = normalizeString(eventTimeWindow);
  if (!windowText) return 1;

  const ranges = [
    { label: '0000 to 0300', start: 0, end: 3 },
    { label: '0300 to 0600', start: 3, end: 6 },
    { label: '0600 to 0900', start: 6, end: 9 },
    { label: '0900 to 1200', start: 9, end: 12 },
    { label: '1200 to 1500', start: 12, end: 15 },
    { label: '1500 to 1800', start: 15, end: 18 },
    { label: '1800 to 2100', start: 18, end: 21 },
    { label: '2100 to 0000', start: 21, end: 24 },
  ];

  const matched = ranges.find((range) => windowText.includes(range.label));
  if (!matched) return 1;

  return targetHour >= matched.start && targetHour < matched.end ? 1.15 : 0.9;
}

function getRecencyWeight(occurredAt, now = new Date()) {
  if (!occurredAt) return 0.7;
  const eventTime = new Date(occurredAt).getTime();
  if (!Number.isFinite(eventTime)) return 0.7;

  const deltaDays = Math.max(0, (now.getTime() - eventTime) / (1000 * 60 * 60 * 24));
  const lambda = 0.004;
  return Math.max(0.2, Math.exp(-lambda * deltaDays));
}

function distanceWeight(distanceMeters) {
  if (distanceMeters <= 40) return 1.0;
  if (distanceMeters <= 80) return 0.85;
  if (distanceMeters <= 120) return 0.65;
  if (distanceMeters <= 180) return 0.45;
  if (distanceMeters <= 250) return 0.3;
  return 0;
}

function normalizeFeature(value, cap) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!Number.isFinite(cap) || cap <= 0) return clamp01(value);
  return clamp01(value / cap);
}

function resolveEngineeredFields(accident = {}, now = new Date()) {
  const occurredAt = accident.occurredAt ? new Date(accident.occurredAt) : null;
  const hourFromDate = occurredAt && Number.isFinite(occurredAt.getTime()) ? occurredAt.getHours() : null;
  const hourFromWindow = parseHourFromWindow(accident.timeWindow);
  const effectiveHour = Number.isFinite(hourFromDate) ? hourFromDate : hourFromWindow;

  const severityWeight = Number.isFinite(Number(accident.severityWeight))
    ? Number(accident.severityWeight)
    : mapAccidentSeverityToRisk(accident.severity);

  const recencyWeight = Number.isFinite(Number(accident.recencyWeight))
    ? Number(accident.recencyWeight)
    : getRecencyWeight(accident.occurredAt, now);

  const vulnerableVehicleWeight = Number.isFinite(Number(accident.vulnerableVehicleWeight))
    ? Number(accident.vulnerableVehicleWeight)
    : mapVehicleVulnerability(accident.vehicleType);

  return {
    hourBin: accident.hourBin || toHourBin(effectiveHour),
    isNight: typeof accident.isNight === 'boolean' ? accident.isNight : isNightHour(effectiveHour),
    severityWeight: clamp01(severityWeight),
    recencyWeight: clamp01(recencyWeight),
    vulnerableVehicleWeight: clamp01(vulnerableVehicleWeight),
  };
}

function computeAccidentFeatureVector({
  point,
  accidents = [],
  now = new Date(),
  roadType = 'unknown',
  radiusMeters = 250,
  snapThresholdMeters = 50,
}) {
  const normalizedRoadType = normalizeRoadType(roadType);
  const targetHour = now.getHours();

  let snappedCount = 0;
  let severitySum = 0;
  let nightCount = 0;
  let vulnerableSum = 0;
  let recentSum = 0;

  accidents.forEach((accident) => {
    const coords = accident?.location?.coordinates || [];
    const accidentPoint = {
      latitude: Number(coords[1]),
      longitude: Number(coords[0]),
    };

    if (!Number.isFinite(accidentPoint.latitude) || !Number.isFinite(accidentPoint.longitude)) {
      return;
    }

    const meters = haversineDistanceMeters(point, accidentPoint);
    if (meters > radiusMeters) {
      return;
    }

    const nearEdgeWeight = meters <= snapThresholdMeters ? 1 : 0.35;
    const dist = distanceWeight(meters);
    const fields = resolveEngineeredFields(accident, now);
    const timeOverlap = getTimeWindowOverlapWeight(accident.timeWindow, targetHour);

    const accidentRoadType = normalizeRoadType(accident.roadType);
    const roadTypeBoost =
      normalizedRoadType !== 'unknown' && accidentRoadType === normalizedRoadType ? 1.12 : 1;

    if (meters <= snapThresholdMeters) {
      snappedCount += 1;
    }

    severitySum += fields.severityWeight * dist * nearEdgeWeight * roadTypeBoost;
    nightCount += (fields.isNight ? 1 : 0) * nearEdgeWeight;
    vulnerableSum += fields.vulnerableVehicleWeight * nearEdgeWeight;
    recentSum += fields.recencyWeight * timeOverlap * nearEdgeWeight;
  });

  const denominator = Math.max(1, snappedCount);

  // Step 6: Normalized edge features in [0,1]
  const C = normalizeFeature(snappedCount, 8);
  const S = normalizeFeature(severitySum, 4.5);
  const N = clamp01(nightCount / denominator);
  const V = clamp01(vulnerableSum / denominator);
  const T = clamp01(recentSum / denominator);

  return {
    C,
    S,
    N,
    V,
    T,
    snapped_count: snappedCount,
    radius_m: radiusMeters,
    snap_threshold_m: snapThresholdMeters,
  };
}

function computeAccidentRiskNearPoint({
  point,
  accidents = [],
  now = new Date(),
  roadType = 'unknown',
  fallback = 0.05,
  radiusMeters = 250,
  snapThresholdMeters = 50,
  weights = DEFAULT_WEIGHTS,
}) {
  const vector = computeAccidentFeatureVector({
    point,
    accidents,
    now,
    roadType,
    radiusMeters,
    snapThresholdMeters,
  });

  const w1 = Number(weights.count ?? DEFAULT_WEIGHTS.count);
  const w2 = Number(weights.severity ?? DEFAULT_WEIGHTS.severity);
  const w3 = Number(weights.night ?? DEFAULT_WEIGHTS.night);
  const w4 = Number(weights.vulnerable ?? DEFAULT_WEIGHTS.vulnerable);
  const w5 = Number(weights.recent ?? DEFAULT_WEIGHTS.recent);

  // Step 7: R_e = w1*C + w2*S + w3*N + w4*V + w5*T
  const risk = clamp01((w1 * vector.C) + (w2 * vector.S) + (w3 * vector.N) + (w4 * vector.V) + (w5 * vector.T));
  return clamp01(Math.max(fallback, risk));
}

module.exports = {
  normalizeRoadType,
  mapAccidentSeverityToRisk,
  mapVehicleVulnerability,
  parseHourFromWindow,
  toHourBin,
  isNightHour,
  getRecencyWeight,
  resolveEngineeredFields,
  computeAccidentFeatureVector,
  DEFAULT_WEIGHTS,
  computeAccidentRiskNearPoint,
};
