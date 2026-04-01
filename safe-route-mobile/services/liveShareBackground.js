import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './apiClient';
import { LIVE_SESSION_ID_KEY } from '../utils/storageKeys';

const LIVE_SHARE_TASK = 'safe-route-live-share-task';

if (!TaskManager.isTaskDefined(LIVE_SHARE_TASK)) {
  TaskManager.defineTask(LIVE_SHARE_TASK, async ({ data, error }) => {
    if (error) {
      console.warn('Live share task error:', error?.message || error);
      return;
    }

    const sessionId = await AsyncStorage.getItem(LIVE_SESSION_ID_KEY);
    if (!sessionId) {
      return;
    }

    const locations = data?.locations || [];
    const latest = locations[locations.length - 1];
    if (!latest?.coords) {
      return;
    }

    try {
      await apiRequest(`/api/live/update/${sessionId}`, {
        method: 'POST',
        body: JSON.stringify({
          latitude: latest.coords.latitude,
          longitude: latest.coords.longitude,
        }),
      });
    } catch (requestError) {
      console.warn('Live share background update failed:', requestError?.message || requestError);
    }
  });
}

export async function startBackgroundLiveShareUpdates(intervalMs = 5000) {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') {
    return false;
  }

  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LIVE_SHARE_TASK);
  if (hasStarted) {
    return true;
  }

  await Location.startLocationUpdatesAsync(LIVE_SHARE_TASK, {
    accuracy: Location.Accuracy.Highest,
    timeInterval: intervalMs,
    distanceInterval: 5,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'SafeRoute Live Share',
      notificationBody: 'Sharing your live location in the background.',
    },
  });

  return true;
}

export async function stopBackgroundLiveShareUpdates() {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(LIVE_SHARE_TASK);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(LIVE_SHARE_TASK);
  }
}
