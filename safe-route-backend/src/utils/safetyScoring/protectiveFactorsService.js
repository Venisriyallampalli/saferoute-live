const { haversineDistanceMeters, clamp01 } = require('./helpers');

const OVERPASS_BASE_URL = process.env.OVERPASS_API_URL || 'https://overpass-api.de/api/interpreter';

function mapPoiType(tags = {}) {
  const amenity = String(tags.amenity || '').toLowerCase();
  const highway = String(tags.highway || '').toLowerCase();
  const emergency = String(tags.emergency || '').toLowerCase();

  if (amenity === 'hospital' || emergency === 'hospital') return 'hospital';
  if (amenity === 'police') return 'police';
  if (amenity === 'shelter' || emergency === 'shelter') return 'shelter';
  if (highway === 'rest_area' || amenity === 'parking' || amenity === 'fuel') return 'rest_point';
  return null;
}

function toLatLng(element) {
  if (Number.isFinite(Number(element?.lat)) && Number.isFinite(Number(element?.lon))) {
    return {
      latitude: Number(element.lat),
      longitude: Number(element.lon),
    };
  }

  const center = element?.center;
  if (Number.isFinite(Number(center?.lat)) && Number.isFinite(Number(center?.lon))) {
    return {
      latitude: Number(center.lat),
      longitude: Number(center.lon),
    };
  }

  return null;
}

async function fetchProtectivePoisNearPoint({ latitude, longitude, radiusMeters = 4000 }) {
  const safeRadius = Math.max(500, Math.min(10000, Number(radiusMeters) || 4000));

  const query = `
    [out:json][timeout:20];
    (
      node(around:${safeRadius},${latitude},${longitude})[amenity=hospital];
      way(around:${safeRadius},${latitude},${longitude})[amenity=hospital];
      relation(around:${safeRadius},${latitude},${longitude})[amenity=hospital];

      node(around:${safeRadius},${latitude},${longitude})[amenity=police];
      way(around:${safeRadius},${latitude},${longitude})[amenity=police];
      relation(around:${safeRadius},${latitude},${longitude})[amenity=police];

      node(around:${safeRadius},${latitude},${longitude})[amenity=shelter];
      way(around:${safeRadius},${latitude},${longitude})[amenity=shelter];
      relation(around:${safeRadius},${latitude},${longitude})[amenity=shelter];

      node(around:${safeRadius},${latitude},${longitude})[highway=rest_area];
      way(around:${safeRadius},${latitude},${longitude})[highway=rest_area];
      relation(around:${safeRadius},${latitude},${longitude})[highway=rest_area];

      node(around:${safeRadius},${latitude},${longitude})[amenity=parking];
      way(around:${safeRadius},${latitude},${longitude})[amenity=parking];
      relation(around:${safeRadius},${latitude},${longitude})[amenity=parking];

      node(around:${safeRadius},${latitude},${longitude})[amenity=fuel];
      way(around:${safeRadius},${latitude},${longitude})[amenity=fuel];
      relation(around:${safeRadius},${latitude},${longitude})[amenity=fuel];
    );
    out center;
  `.trim();

  const response = await fetch(OVERPASS_BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Overpass request failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  const elements = Array.isArray(json?.elements) ? json.elements : [];

  const pois = elements
    .map((element) => {
      const point = toLatLng(element);
      if (!point) return null;
      const type = mapPoiType(element.tags || {});
      if (!type) return null;

      return {
        type,
        latitude: point.latitude,
        longitude: point.longitude,
      };
    })
    .filter(Boolean);

  return pois;
}

function getProtectiveScoreNearPoint(point, pois = []) {
  if (!point || !Array.isArray(pois) || pois.length === 0) {
    return 0;
  }

  let score = 0;

  pois.forEach((poi) => {
    const meters = haversineDistanceMeters(point, {
      latitude: poi.latitude,
      longitude: poi.longitude,
    });

    if (!Number.isFinite(meters) || meters > 1500) {
      return;
    }

    const typeWeight =
      poi.type === 'hospital'
        ? 1.0
        : poi.type === 'police'
          ? 0.9
          : poi.type === 'shelter'
            ? 0.75
            : 0.55;

    const distanceWeight =
      meters <= 150
        ? 1.0
        : meters <= 300
          ? 0.8
          : meters <= 600
            ? 0.55
            : 0.3;

    score += typeWeight * distanceWeight;
  });

  return clamp01(score / 2.2);
}

function summarizeProtectivePois(pois = []) {
  const summary = {
    hospital: 0,
    police: 0,
    shelter: 0,
    rest_point: 0,
  };

  pois.forEach((poi) => {
    if (summary[poi.type] != null) {
      summary[poi.type] += 1;
    }
  });

  return summary;
}

module.exports = {
  fetchProtectivePoisNearPoint,
  getProtectiveScoreNearPoint,
  summarizeProtectivePois,
};
