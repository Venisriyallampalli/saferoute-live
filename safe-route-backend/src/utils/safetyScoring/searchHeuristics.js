const { clamp01 } = require('./helpers');

const POLICY_CONFIG = {
  safest: {
    alpha: 0.35,
    beta: 0.1,
    gamma: 0.55,
    minSafetyScore: 70,
  },
  balanced: {
    alpha: 0.55,
    beta: 0.15,
    gamma: 0.3,
    minSafetyScore: 60,
  },
  fastest: {
    alpha: 0.75,
    beta: 0.2,
    gamma: 0.05,
    minSafetyScore: 45,
  },
};

function clampPositive(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

function getPolicyWeights(policy = 'balanced') {
  const key = String(policy || '').toLowerCase();
  return POLICY_CONFIG[key] || POLICY_CONFIG.balanced;
}

function chooseAoPolicy({
  preferredMode,
  maxExtraTimePercent,
  minSafetyScore,
} = {}) {
  const mode = String(preferredMode || '').toLowerCase();
  if (mode === 'safest' || mode === 'fastest' || mode === 'balanced') {
    return mode;
  }

  if (Number.isFinite(Number(minSafetyScore)) && Number(minSafetyScore) >= 75) {
    return 'safest';
  }

  if (Number.isFinite(Number(maxExtraTimePercent)) && Number(maxExtraTimePercent) <= 10) {
    return 'fastest';
  }

  return 'balanced';
}

function computeTraversalCost({
  distanceMeters,
  durationSeconds,
  riskScore,
  policy,
}) {
  const { alpha, beta, gamma } = getPolicyWeights(policy);
  const dKm = clampPositive(distanceMeters) / 1000;
  const durationMin = clampPositive(durationSeconds) / 60;
  const risk = clamp01(riskScore);

  return Number((alpha * durationMin + beta * dKm + gamma * (risk * 10)).toFixed(4));
}

function estimateRemainingHeuristic({
  straightLineMeters,
  riskDensityPerKm,
  policy,
  maxSpeedMps = 20,
}) {
  const { alpha, gamma } = getPolicyWeights(policy);
  const distanceMeters = clampPositive(straightLineMeters);
  const speed = Math.max(1, clampPositive(maxSpeedMps, 20));

  const optimisticTimeMin = (distanceMeters / speed) / 60;
  const riskDensity = clamp01(riskDensityPerKm);
  const riskBound = (distanceMeters / 1000) * riskDensity;

  return Number((alpha * optimisticTimeMin + gamma * riskBound).toFixed(4));
}

function scoreRouteByPolicy(route = {}, policy = 'balanced') {
  const heuristics = route.search_heuristics || {};
  if (policy === 'fastest') {
    return clampPositive(heuristics.greedy_h, Number.MAX_SAFE_INTEGER);
  }
  return clampPositive(heuristics.astar_f, Number.MAX_SAFE_INTEGER);
}

function evaluateAoConstraints(route, constraints = {}, baselineDurationSeconds = null) {
  const minSafetyScore = Number(constraints.minSafetyScore);
  if (Number.isFinite(minSafetyScore) && Number(route?.safety_score || 0) < minSafetyScore) {
    return { pass: false, reason: 'min_safety_score' };
  }

  const maxExtraTimePercent = Number(constraints.maxExtraTimePercent);
  if (
    Number.isFinite(maxExtraTimePercent)
    && Number.isFinite(Number(baselineDurationSeconds))
    && Number.isFinite(Number(route?.durationSeconds))
  ) {
    const allowed = baselineDurationSeconds * (1 + (maxExtraTimePercent / 100));
    if (Number(route.durationSeconds) > allowed) {
      return { pass: false, reason: 'max_extra_time_percent' };
    }
  }

  const preferredRoadType = String(constraints.preferredRoadType || '').toLowerCase();
  if (preferredRoadType) {
    const routeRoadType = String(route?.dominant_road_type || '').toLowerCase();
    if (routeRoadType && routeRoadType !== preferredRoadType) {
      return { pass: false, reason: 'road_type_preference' };
    }
  }

  return { pass: true, reason: null };
}

function rankRoutesForPolicy(routes = [], policy = 'balanced') {
  return [...routes].sort((a, b) => scoreRouteByPolicy(a, policy) - scoreRouteByPolicy(b, policy));
}

function chooseRouteByAoPolicy({
  routes = [],
  policy = 'balanced',
  constraints = {},
}) {
  if (!Array.isArray(routes) || routes.length === 0) {
    return { recommendedRouteId: null, rankedRouteIds: [] };
  }

  const baselineDurationSeconds = routes.reduce((min, route) => {
    const value = Number(route?.durationSeconds);
    if (!Number.isFinite(value)) return min;
    if (min == null) return value;
    return Math.min(min, value);
  }, null);

  const ranked = rankRoutesForPolicy(routes, policy);
  const feasible = ranked.filter((route) => evaluateAoConstraints(route, constraints, baselineDurationSeconds).pass);
  const picked = feasible[0] || ranked[0];

  return {
    recommendedRouteId: picked?.route_id || picked?.id || null,
    rankedRouteIds: ranked.map((route) => route?.route_id || route?.id).filter(Boolean),
  };
}

module.exports = {
  getPolicyWeights,
  chooseAoPolicy,
  computeTraversalCost,
  estimateRemainingHeuristic,
  scoreRouteByPolicy,
  evaluateAoConstraints,
  rankRoutesForPolicy,
  chooseRouteByAoPolicy,
};
