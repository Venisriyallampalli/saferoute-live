const {
  clamp,
  haversineDistanceMeters,
  interpolatePoint,
  normalizeRouteCoordinates,
} = require('./helpers');

function segmentRoute(coordinates, preferredLengthMeters = 100) {
  const normalizedLength = clamp(Number(preferredLengthMeters) || 100, 50, 100);
  const normalizedCoordinates = normalizeRouteCoordinates(coordinates);

  if (!Array.isArray(normalizedCoordinates) || normalizedCoordinates.length < 2) {
    return [];
  }

  const segments = [];
  let segmentIndex = 0;

  for (let i = 0; i < normalizedCoordinates.length - 1; i += 1) {
    const start = normalizedCoordinates[i];
    const end = normalizedCoordinates[i + 1];

    const edgeDistance = haversineDistanceMeters(start, end);
    if (edgeDistance <= 0) {
      continue;
    }

    const parts = Math.max(1, Math.ceil(edgeDistance / normalizedLength));
    for (let p = 0; p < parts; p += 1) {
      const t0 = p / parts;
      const t1 = (p + 1) / parts;

      const pointA = interpolatePoint(start, end, t0);
      const pointB = interpolatePoint(start, end, t1);
      const midpoint = interpolatePoint(pointA, pointB, 0.5);

      segments.push({
        segment_id: `seg-${segmentIndex}`,
        index: segmentIndex,
        start: pointA,
        end: pointB,
        midpoint,
        lengthMeters: haversineDistanceMeters(pointA, pointB),
      });

      segmentIndex += 1;
    }
  }

  return segments;
}

module.exports = {
  segmentRoute,
};
