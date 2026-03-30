import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequestWithFallback } from './apiClient';
import { SETTINGS_KEY_PREFIX } from '../utils/storageKeys';

const defaultSettings = {
  notificationsEnabled: true,
  highRiskAlerts: true,
  autoSosEnabled: true,
  shareLiveLocationByDefault: true,
  autoSmsShareToTrustedContacts: false,
  profile: {
    displayName: '',
    phone: '',
    emergencyNote: '',
  },
};

function getSettingsStorageKey(userId = 'anonymous') {
  return `${SETTINGS_KEY_PREFIX}:${userId}`;
}

export function getDefaultSettings() {
  return defaultSettings;
}

export async function loadSettings(userId = 'anonymous') {
  const key = getSettingsStorageKey(userId);
  const local = await AsyncStorage.getItem(key);
  const parsed = local ? JSON.parse(local) : defaultSettings;

  const remote = await apiRequestWithFallback('/api/settings', {}, { settings: parsed });
  const merged = {
    ...defaultSettings,
    ...(remote?.settings || parsed),
    profile: {
      ...defaultSettings.profile,
      ...(remote?.settings?.profile || parsed.profile || {}),
    },
  };

  await AsyncStorage.setItem(key, JSON.stringify(merged));
  return merged;
}

export async function saveSettings(userId = 'anonymous', settings = defaultSettings) {
  const key = getSettingsStorageKey(userId);

  await AsyncStorage.setItem(key, JSON.stringify(settings));

  await apiRequestWithFallback(
    '/api/settings',
    {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    },
    { success: true }
  );

  return settings;
}
