import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Share Service
 * Handles API calls for location sharing feature
 */

const API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';

/**
 * Get JWT token from AsyncStorage
 */
const getToken = async () => {
  return await AsyncStorage.getItem('token');
};

/**
 * Make authenticated API request
 */
const apiRequest = async (endpoint, options = {}) => {
  const token = await getToken();
  
  if (!token) {
    const error = new Error('Authentication required. Please login.');
    error.code = 'NO_TOKEN';
    throw error;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.message || error.error || 'Request failed');
  }

  return response.json();
};

/**
 * Create a location sharing request
 */
export const requestLocationShare = async (toUserId) => {
  return apiRequest('/api/share/request', {
    method: 'POST',
    body: JSON.stringify({ toUserId })
  });
};

/**
 * Get all share requests
 */
export const getShareRequests = async () => {
  return apiRequest('/api/share/requests');
};

/**
 * Approve a share request
 */
export const approveShareRequest = async (requestId) => {
  return apiRequest(`/api/share/requests/${requestId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approve: true })
  });
};

/**
 * Reject a share request
 */
export const rejectShareRequest = async (requestId) => {
  return apiRequest(`/api/share/requests/${requestId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ approve: false })
  });
};

/**
 * Revoke a pending request
 */
export const revokeShareRequest = async (requestId) => {
  return apiRequest(`/api/share/requests/${requestId}/revoke`, {
    method: 'POST'
  });
};

/**
 * Revoke an active sharing session
 */
export const revokeShareSession = async (sessionId) => {
  return apiRequest(`/api/share/session/${sessionId}/revoke`, {
    method: 'POST'
  });
};

/**
 * Get active sessions
 */
export const getActiveSessions = async () => {
  return apiRequest('/api/share/sessions');
};

/**
 * Start direct location sharing
 */
export const startDirectShare = async (toUserId, toUsername) => {
  const body = {};
  if (toUserId) body.toUserId = toUserId;
  if (toUsername) body.toUsername = toUsername;
  
  return apiRequest('/api/share/direct', {
    method: 'POST',
    body: JSON.stringify(body)
  });
};

/**
 * Search users
 */
export const searchUsers = async (query) => {
  return apiRequest(`/api/share/users/search?q=${encodeURIComponent(query)}`);
};
