import { API_BASE_URL, MAPBOX_TOKEN } from './config';

export async function getRouteFromChat(prompt) {
  const res = await fetch(`${API_BASE_URL}/api/getRouteFromChat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });
  if (!res.ok) throw new Error('Failed to fetch route');
  return res.json();
}

export async function getSafeRoutes(source, destination, preference = 'Well-lit') {
  const params = new URLSearchParams({ source, destination, preference });
  const res = await fetch(`${API_BASE_URL}/api/getSafeRoutes?${params}`);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const error = new Error(errorData.error || 'Failed to fetch safe routes');
    throw error;
  }
  return res.json();
}

export async function getAccidents() {
  const res = await fetch(`${API_BASE_URL}/api/getAccidents`);
  if (!res.ok) throw new Error('Failed to fetch accidents');
  return res.json();
}

export async function getTraffic(coords) {
  const params = new URLSearchParams({ coords: JSON.stringify(coords) });
  const res = await fetch(`${API_BASE_URL}/api/getTraffic?${params}`);
  if (!res.ok) throw new Error('Failed to fetch traffic');
  return res.json();
}

export async function getLighting(coords) {
  const params = new URLSearchParams({ coords: JSON.stringify(coords) });
  const res = await fetch(`${API_BASE_URL}/api/getLighting?${params}`);
  if (!res.ok) throw new Error('Failed to fetch lighting data');
  return res.json();
}

export async function sendSOSAlert(location, message = 'Emergency SOS Alert') {
  const res = await fetch(`${API_BASE_URL}/api/sos-alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location, message })
  });
  if (!res.ok) throw new Error('Failed to send SOS alert');
  return res.json();
}

export async function submitFeedback(routeId, feedback, safetyScore) {
  const res = await fetch(`${API_BASE_URL}/api/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ routeId, feedback, safetyScore })
  });
  if (!res.ok) throw new Error('Failed to submit feedback');
  return res.json();
}

export async function getAISafetySuggestion(source, destination, routes, lat = null, lng = null) {
  const params = new URLSearchParams({
    source,
    destination,
    routes: JSON.stringify(routes)
  });

  if (lat !== null && lng !== null) {
    params.append('lat', lat);
    params.append('lng', lng);
  }

  const res = await fetch(`${API_BASE_URL}/api/ai-safety-suggestion?${params}`);
  if (!res.ok) throw new Error('Failed to get AI safety suggestion');
  return res.json();
}

export async function getAddressSuggestions(query) {
  if (!query || query.length < 2 || !MAPBOX_TOKEN) return [];

  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      types: 'place,locality,neighborhood,address',
      autocomplete: 'true',
      limit: '5'
    });

    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?${params}`
    );

    if (!res.ok) return [];

    const data = await res.json();
    return data.features || [];
  } catch (err) {
    console.error('Error fetching address suggestions:', err);
    return [];
  }
}

export async function getN8NData(lat = null, lng = null) {
  const params = new URLSearchParams();
  if (lat !== null) params.append('lat', lat);
  if (lng !== null) params.append('lng', lng);

  const res = await fetch(`${API_BASE_URL}/api/getN8NData?${params}`);
  if (!res.ok) {
    throw new Error('Failed to fetch n8n data');
  }
  return res.json();
}

export async function reverseGeocode(longitude, latitude) {
  if (!MAPBOX_TOKEN) return null;

  try {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      limit: '1'
    });

    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?${params}`
    );

    if (!res.ok) return null;

    const data = await res.json();
    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      return feature.place_name || feature.text || null;
    }

    return null;
  } catch (err) {
    console.error('Error reverse geocoding:', err);
    return null;
  }
}

export async function getNearbySafePlaces(lat, lng) {
  const params = new URLSearchParams({ lat: lat.toString(), lng: lng.toString() });
  const res = await fetch(`${API_BASE_URL}/api/nearbySafePlaces?${params}`);
  if (!res.ok) {
    throw new Error('Failed to fetch nearby safe places');
  }
  return res.json();
}
