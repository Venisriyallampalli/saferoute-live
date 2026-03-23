import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequestWithFallback } from './apiClient';
import { HAZARD_REPORTS_KEY_PREFIX } from '../utils/storageKeys';

function getHazardStorageKey(userId = 'anonymous') {
  return `${HAZARD_REPORTS_KEY_PREFIX}:${userId}`;
}

export async function loadHazardReports(userId = 'anonymous') {
  const key = getHazardStorageKey(userId);
  const local = await AsyncStorage.getItem(key);
  const localReports = local ? JSON.parse(local) : [];

  const remote = await apiRequestWithFallback('/api/hazards', {}, { hazards: localReports });
  const hazards = Array.isArray(remote?.hazards) ? remote.hazards : localReports;

  await AsyncStorage.setItem(key, JSON.stringify(hazards));
  return hazards;
}

export async function submitHazardReport(userId = 'anonymous', report) {
  const key = getHazardStorageKey(userId);
  const local = await AsyncStorage.getItem(key);
  const previous = local ? JSON.parse(local) : [];

  const payload = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: report.type,
    description: report.description || '',
    latitude: report.latitude,
    longitude: report.longitude,
    address: report.address || '',
    createdAt: new Date().toISOString(),
    source: 'mobile',
  };

  const next = [payload, ...previous];
  await AsyncStorage.setItem(key, JSON.stringify(next));

  await apiRequestWithFallback(
    '/api/hazards',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    { success: true, hazard: payload }
  );

  return payload;
}
