import { apiRequest } from './apiClient';

/**
 * Get all friends
 */
export const getFriends = async () => {
  return apiRequest('/api/friends');
};

/**
 * Get friend requests (sent and received)
 */
export const getFriendRequests = async () => {
  return apiRequest('/api/friends/requests');
};

/**
 * Send friend request
 */
export const sendFriendRequest = async (recipientId) => {
  return apiRequest('/api/friends/request', {
    method: 'POST',
    body: JSON.stringify({ recipientId })
  });
};

/**
 * Accept friend request
 */
export const acceptFriendRequest = async (requestId) => {
  return apiRequest(`/api/friends/accept/${requestId}`, {
    method: 'POST',
  });
};

/**
 * Delete/Reject friend request
 */
export const deleteFriendRequest = async (requestId) => {
  return apiRequest(`/api/friends/request/${requestId}`, {
    method: 'DELETE',
  });
};

/**
 * Remove friend
 */
export const removeFriend = async (friendshipId) => {
  return apiRequest(`/api/friends/${friendshipId}`, {
    method: 'DELETE',
  });
};

/**
 * Search users
 */
export const searchUsers = async (query) => {
  return apiRequest(`/api/friends/search?q=${encodeURIComponent(query)}`);
};
