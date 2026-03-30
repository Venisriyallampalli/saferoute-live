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

function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') {
    return [];
  }

  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < encoded.length) {
    let b;
    let shift = 0;
    let result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dLat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dLat;

    shift = 0;
    result = 0;

    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);

    const dLng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dLng;

    coordinates.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }

  return coordinates;
}

function normalizeCoordinatePoint(point) {
  if (!point) return null;

  if (Array.isArray(point) && point.length >= 2) {
    const [longitude, latitude] = point;
    return {
      latitude: Number(latitude),
      longitude: Number(longitude),
    };
  }

  const latitude = Number(point.latitude ?? point.lat);
  const longitude = Number(point.longitude ?? point.lng ?? point.lon);

  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

function normalizeRouteCoordinates(rawCoordinates) {
  if (typeof rawCoordinates === 'string') {
    return decodePolyline(rawCoordinates);
  }

  if (!Array.isArray(rawCoordinates)) {
    return [];
  }

  return rawCoordinates
    .map(normalizeCoordinatePoint)
    .filter((point) => point && Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
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
  const normalized = normalizeRouteCoordinates(coordinates);
  if (!normalized.length) {
    return null;
  }

  const middleIndex = Math.floor(normalized.length / 2);
  const point = normalized[middleIndex];

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
  decodePolyline,
  normalizeCoordinatePoint,
  normalizeRouteCoordinates,
};
