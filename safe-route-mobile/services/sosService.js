import { apiRequestWithFallback } from './apiClient';
import { buildLiveLocationLink } from './locationService';

export function createSosPayload({ user, location, contacts = [], message = 'Emergency SOS Alert' }) {
  const link = location ? buildLiveLocationLink(location.latitude, location.longitude) : null;

  return {
    type: 'SOS_ALERT',
    message,
    user: {
      id: user?.id || user?._id || 'anonymous',
      name: user?.name || 'SafeRoute User',
      email: user?.email || null,
      phone: user?.phone || null,
    },
    location: location
      ? {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          link,
        }
      : null,
    contacts,
    timestamp: new Date().toISOString(),
  };
}

export async function sendSosAlert(payload) {
  return apiRequestWithFallback(
    '/api/sos-alert',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    { success: true, fallback: true }
  );
}
