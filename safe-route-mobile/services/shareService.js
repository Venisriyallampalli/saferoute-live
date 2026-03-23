import { apiRequest } from './apiClient';

/**
 * Share Service
 * Handles API calls for location sharing feature
 */

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
