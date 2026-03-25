function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function toRadians(deg) {
  return (deg * Math.PI) / 180;
}

function haversineDistanceMeters(a, b) {
  const earthRadiusMeters = 6371000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * earthRadiusMeters * Math.asin(Math.sqrt(h));
}

function interpolatePoint(a, b, t) {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

function pseudoRandom01(seedInput) {
  const text = String(seedInput);
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

function getRouteMidpoint(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length === 0) {
    return null;
  }

  const middleIndex = Math.floor(coordinates.length / 2);
  const point = coordinates[middleIndex];

  return {
    latitude: Number(point.latitude),
    longitude: Number(point.longitude),
  };
}

module.exports = {
  clamp,
  clamp01,
  haversineDistanceMeters,
  interpolatePoint,
  pseudoRandom01,
  getRouteMidpoint,
};
