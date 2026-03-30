import { apiRequest } from './apiClient';
import { buildLiveLocationLink } from './locationService';
import * as SMS from 'expo-sms';

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

export async function triggerSosAlert({ userId, latitude, longitude, timestamp }) {
  return apiRequest('/api/sos/trigger', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      latitude,
      longitude,
      timestamp,
    }),
  });
}

export async function updateSosLocation({ alertId, latitude, longitude, timestamp }) {
  return apiRequest('/api/sos/update-location', {
    method: 'POST',
    body: JSON.stringify({
      alert_id: alertId,
      latitude,
      longitude,
      timestamp,
    }),
  });
}

export async function notifyContactsBySms(contacts = [], latitude, longitude) {
  const phones = contacts.map((item) => String(item?.phone || '').trim()).filter(Boolean);
  if (!phones.length) {
    return { sent: false, count: 0, reason: 'no_contacts' };
  }

  const message = `SOS Alert! User needs help: https://maps.google.com/?q=${latitude},${longitude}`;
  const available = await SMS.isAvailableAsync();

  if (!available) {
    return { sent: false, count: 0, reason: 'sms_not_available', message };
  }

  await SMS.sendSMSAsync(phones, message);
  return { sent: true, count: phones.length, message };
}
