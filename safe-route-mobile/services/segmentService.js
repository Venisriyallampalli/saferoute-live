function toRad(value) {
  return (value * Math.PI) / 180;
}

export function haversineMeters(a, b) {
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

function interpolatePoint(a, b, t) {
  return {
    latitude: (a.latitude || 0) + (((b.latitude || 0) - (a.latitude || 0)) * t),
    longitude: (a.longitude || 0) + (((b.longitude || 0) - (a.longitude || 0)) * t),
  };
}

function decodePolyline(encoded) {
  if (!encoded || typeof encoded !== 'string') return [];

  let index = 0;
  let lat = 0;
  let lng = 0;
  const points = [];

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dLat = (result & 1) ? ~(result >> 1) : result >> 1;
    lat += dLat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dLng = (result & 1) ? ~(result >> 1) : result >> 1;
    lng += dLng;

    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }

  return points;
}

function normalizePoint(point) {
  if (!point) return null;

  if (Array.isArray(point) && point.length >= 2) {
    return {
      latitude: Number(point[1]),
      longitude: Number(point[0]),
    };
  }

  const latitude = Number(point.latitude ?? point.lat);
  const longitude = Number(point.longitude ?? point.lng ?? point.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return { latitude, longitude };
}

export function normalizeRouteCoordinates(rawCoordinates) {
  if (typeof rawCoordinates === 'string') {
    return decodePolyline(rawCoordinates);
  }

  if (!Array.isArray(rawCoordinates)) {
    return [];
  }

  return rawCoordinates.map(normalizePoint).filter(Boolean);
}

export function segmentRouteCoordinates(rawCoordinates, preferredLengthMeters = 75) {
  const coordinates = normalizeRouteCoordinates(rawCoordinates);
  if (coordinates.length < 2) return [];

  const targetLength = Math.max(50, Math.min(100, Number(preferredLengthMeters) || 75));
  const segments = [];
  let index = 0;

  for (let i = 0; i < coordinates.length - 1; i += 1) {
    const start = coordinates[i];
    const end = coordinates[i + 1];
    const distance = haversineMeters(start, end);
    if (distance <= 0) continue;

    const parts = Math.max(1, Math.ceil(distance / targetLength));

    for (let part = 0; part < parts; part += 1) {
      const t0 = part / parts;
      const t1 = (part + 1) / parts;
      const pointA = interpolatePoint(start, end, t0);
      const pointB = interpolatePoint(start, end, t1);
      const midpoint = interpolatePoint(pointA, pointB, 0.5);

      segments.push({
        segment_id: `seg-${index}`,
        start: pointA,
        end: pointB,
        midpoint,
        length_m: haversineMeters(pointA, pointB),
      });

      index += 1;
    }
  }

  return segments;
}
