import { Platform } from 'react-native';

const API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';

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

export async function getCrimeData() {
  const res = await fetch(`${API_BASE_URL}/api/getCrimeData`);
  if (!res.ok) throw new Error('Failed to fetch crime data');
  return res.json();
}

export async function sendSOSAlert(location, message = 'Emergency SOS Alert') {
  const res = await fetch(`${API_BASE_URL}/api/sos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location, message })
  });
  if (!res.ok) throw new Error('Failed to send SOS alert');
  return res.json();
}

export async function getNearbySafePlaces(lat, lng) {
  const params = new URLSearchParams({ lat: lat.toString(), lng: lng.toString() });
  const res = await fetch(`${API_BASE_URL}/api/nearbySafePlaces?${params}`);
  if (!res.ok) {
    throw new Error('Failed to fetch nearby safe places');
  }
  return res.json();
}
