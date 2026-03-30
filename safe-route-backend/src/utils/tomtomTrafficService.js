function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineMeters(a, b) {
  const r = 6371000;
  const dLat = toRadians((b.latitude || 0) - (a.latitude || 0));
  const dLon = toRadians((b.longitude || 0) - (a.longitude || 0));
  const lat1 = toRadians(a.latitude || 0);
  const lat2 = toRadians(b.latitude || 0);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * r * Math.asin(Math.sqrt(h));
}

function bboxFromCenter(latitude, longitude, radiusKm = 3) {
  const lat = Number(latitude);
  const lng = Number(longitude);
  const km = Math.max(0.2, Number(radiusKm) || 3);

  const latDelta = km / 110.574;
  const lngDelta = km / (111.320 * Math.cos((lat * Math.PI) / 180));

  return {
    minLat: lat - latDelta,
    minLng: lng - lngDelta,
    maxLat: lat + latDelta,
    maxLng: lng + lngDelta,
  };
}

function mapIncidentCategoryToRisk(category) {
  const numeric = Number(category);
  if (!Number.isFinite(numeric)) return 0.08;
  if (numeric >= 11) return 0.24;
  if (numeric >= 8) return 0.18;
  if (numeric >= 5) return 0.14;
  return 0.1;
}

function normalizeTomTomIncident(incident, index = 0) {
  const properties = incident?.properties || {};
  const geometry = incident?.geometry || {};
  const coords = Array.isArray(geometry.coordinates) ? geometry.coordinates : [];
  const first = Array.isArray(coords[0]) ? coords[0] : null;

  const longitude = Number(first?.[0]);
  const latitude = Number(first?.[1]);

  const events = Array.isArray(properties.events) ? properties.events : [];
  const description = events.find((event) => event?.description)?.description || properties.from || 'Traffic incident';

  return {
    id: String(incident?.id || `tomtom-${index}`),
    type: 'traffic_incident',
    description,
    iconCategory: Number(properties.iconCategory || 0),
    magnitudeOfDelay: Number(properties.magnitudeOfDelay || 0),
    latitude,
    longitude,
    risk: mapIncidentCategoryToRisk(properties.iconCategory),
    source: 'tomtom',
    raw: {
      from: properties.from,
      to: properties.to,
      length: properties.length,
      startTime: properties.startTime,
      endTime: properties.endTime,
    },
  };
}

function normalizeTrafficDensity(summary = {}) {
  const travelTime = Number(summary.travelTimeInSeconds || 0);
  const delay = Number(summary.trafficDelayInSeconds || 0);

  if (travelTime <= 0) return 0.5;

  const ratio = delay / travelTime;
  return clamp(ratio * 1.5, 0, 1);
}

function speedToFlowPercent(currentSpeed, freeFlowSpeed) {
  const current = Number(currentSpeed || 0);
  const freeFlow = Number(freeFlowSpeed || 0);
  if (current <= 0 || freeFlow <= 0) return null;

  return Math.round(clamp((current / freeFlow) * 100, 0, 100));
}

async function fetchTomTomFlowStats({ apiKey, latitude, longitude }) {
  if (!apiKey) {
    throw new Error('Missing TOMTOM_API_KEY');
  }

  const params = new URLSearchParams({
    key: apiKey,
    point: `${latitude},${longitude}`,
  });

  const response = await fetch(`https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TomTom flow request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const segment = data?.flowSegmentData || {};

  const trafficFlow = speedToFlowPercent(segment.currentSpeed, segment.freeFlowSpeed);

  return {
    trafficFlow: trafficFlow != null ? trafficFlow : 60,
    currentSpeed: Number(segment.currentSpeed || 0),
    freeFlowSpeed: Number(segment.freeFlowSpeed || 0),
    confidence: segment.confidence ?? null,
  };
}

async function fetchTomTomIncidentsInBbox({ apiKey, minLat, minLng, maxLat, maxLng }) {
  if (!apiKey) {
    throw new Error('Missing TOMTOM_API_KEY');
  }

  const fields = '{incidents{type,geometry{type,coordinates},properties{iconCategory,magnitudeOfDelay,events{description,code},from,to,length,startTime,endTime}}}';

  const params = new URLSearchParams({
    key: apiKey,
    bbox: `${minLng},${minLat},${maxLng},${maxLat}`,
    fields,
    language: 'en-US',
    timeValidityFilter: 'present',
  });

  const response = await fetch(`https://api.tomtom.com/traffic/services/5/incidentDetails?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TomTom incidents request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const rawIncidents = Array.isArray(data?.incidents)
    ? data.incidents
    : Array.isArray(data?.incidents?.incidents)
      ? data.incidents.incidents
      : [];

  return rawIncidents
    .map((incident, index) => normalizeTomTomIncident(incident, index))
    .filter((incident) => Number.isFinite(incident.latitude) && Number.isFinite(incident.longitude));
}

async function getLiveIncidentsNearPoint({ latitude, longitude, radiusKm = 3 }) {
  const apiKey = process.env.TOMTOM_API_KEY;
  if (!apiKey) return [];

  const bbox = bboxFromCenter(latitude, longitude, radiusKm);
  return fetchTomTomIncidentsInBbox({
    apiKey,
    minLat: bbox.minLat,
    minLng: bbox.minLng,
    maxLat: bbox.maxLat,
    maxLng: bbox.maxLng,
  });
}

function getIncidentRiskNearPoint(point, incidents = []) {
  if (!point || !Array.isArray(incidents) || incidents.length === 0) {
    return 0;
  }

  let risk = 0;
  incidents.forEach((incident) => {
    const distance = haversineMeters(point, {
      latitude: incident.latitude,
      longitude: incident.longitude,
    });

    if (distance <= 120) {
      risk += incident.risk || 0.14;
    } else if (distance <= 250) {
      risk += (incident.risk || 0.14) * 0.6;
    } else if (distance <= 500) {
      risk += (incident.risk || 0.14) * 0.35;
    }
  });

  return clamp(risk, 0, 0.5);
}

function buildMockFusionStats() {
  return {
    crowdDensity: 45 + Math.floor(Math.random() * 20),
    trafficFlow: 50 + Math.floor(Math.random() * 25),
    status: 'simulated',
    timestamp: new Date().toISOString(),
  };
}

async function getLiveFusionStats() {
  try {
    const apiKey = process.env.TOMTOM_API_KEY;
    const latitude = Number(process.env.TOMTOM_FLOW_CENTER_LAT || 17.3850);
    const longitude = Number(process.env.TOMTOM_FLOW_CENTER_LNG || 78.4867);

    if (!apiKey) {
      return buildMockFusionStats();
    }

    const flow = await fetchTomTomFlowStats({ apiKey, latitude, longitude });

    return {
      crowdDensity: 45 + Math.floor(Math.random() * 20),
      trafficFlow: flow.trafficFlow,
      status: 'tomtom-live',
      trafficMeta: {
        currentSpeed: flow.currentSpeed,
        freeFlowSpeed: flow.freeFlowSpeed,
        confidence: flow.confidence,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      ...buildMockFusionStats(),
      status: 'fallback',
      reason: error.message,
    };
  }
}

module.exports = {
  normalizeTrafficDensity,
  fetchTomTomFlowStats,
  getLiveFusionStats,
  fetchTomTomIncidentsInBbox,
  getLiveIncidentsNearPoint,
  getIncidentRiskNearPoint,
  bboxFromCenter,
};
