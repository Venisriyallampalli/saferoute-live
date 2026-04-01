import { apiRequest } from './apiClient';

let liveShareIntervalId = null;

async function sendLiveLocationUpdate(sessionId, getLocation) {
  const location = await getLocation();
  return apiRequest(`/api/live/update/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify({
      latitude: location.latitude,
      longitude: location.longitude,
    }),
  });
}

/**
 * Starts a new live sharing session.
 * @param {{ latitude: number, longitude: number }} initialLocation - The user's starting location.
 * @returns {Promise<{sessionId: string, shareUrl: string}>}
 */
export const startLiveShare = async (initialLocation) => {
  try {
    return await apiRequest('/api/live/start', {
      method: 'POST',
      body: JSON.stringify(initialLocation),
    });
  } catch (error) {
    console.error('Error starting live share session:', {
      message: error?.message,
      status: error?.status,
      data: error?.data,
      url: error?.url,
    });
    throw new Error(error?.data?.message || error?.message || 'Could not start live sharing.');
  }
};

/**
 * Updates the location for an active live sharing session.
 * @param {string} sessionId - The ID of the live share session.
 * @param {{ latitude: number, longitude: number }} location - The user's current location.
 * @returns {Promise<any>}
 */
export const updateLiveLocation = (sessionId, location) => {
  return apiRequest(`/api/live/update/${sessionId}`, {
    method: 'POST',
    body: JSON.stringify(location),
  });
};

export const startLiveShareUpdates = async (sessionId, getLocation, intervalMs = 10000) => {
  if (!sessionId || typeof getLocation !== 'function') return;

  if (liveShareIntervalId) {
    clearInterval(liveShareIntervalId);
  }

  await sendLiveLocationUpdate(sessionId, getLocation);

  liveShareIntervalId = setInterval(async () => {
    try {
      await sendLiveLocationUpdate(sessionId, getLocation);
    } catch (error) {
      console.warn('Failed to send live location update:', error?.message || error);
    }
  }, intervalMs);
};

export const stopLiveShareUpdates = () => {
  if (liveShareIntervalId) {
    clearInterval(liveShareIntervalId);
    liveShareIntervalId = null;
  }
};

/**
 * Stops an active live sharing session.
 * @param {string} sessionId - The ID of the live share session.
 * @returns {Promise<any>}
 */
export const stopLiveShare = (sessionId) => {
  return apiRequest(`/api/live/stop/${sessionId}`, {
    method: 'POST',
  });
};
