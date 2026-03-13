import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const API_BASE_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';

// Get auth token asynchronously
const getToken = async () => await AsyncStorage.getItem('token');

// Get auth headers
const getAuthHeaders = async () => {
  const token = await getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

/**
 * Get all friends
 */
export const getFriends = async () => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/friends`, { headers });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    throw new Error('Failed to fetch friends');
  }
  
  return response.json();
};

/**
 * Get friend requests (sent and received)
 */
export const getFriendRequests = async () => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/friends/requests`, { headers });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    throw new Error('Failed to fetch friend requests');
  }
  
  return response.json();
};

/**
 * Send friend request
 */
export const sendFriendRequest = async (recipientId) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/friends/request`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ recipientId })
  });
  
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to send friend request');
  }
  
  return response.json();
};

/**
 * Accept friend request
 */
export const acceptFriendRequest = async (requestId) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/friends/accept/${requestId}`, {
    method: 'POST',
    headers
  });
  
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to accept friend request');
  }
  
  return response.json();
};

/**
 * Delete/Reject friend request
 */
export const deleteFriendRequest = async (requestId) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/friends/request/${requestId}`, {
    method: 'DELETE',
    headers
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete friend request');
  }
  
  return response.json();
};

/**
 * Remove friend
 */
export const removeFriend = async (friendshipId) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/friends/${friendshipId}`, {
    method: 'DELETE',
    headers
  });
  
  if (!response.ok) {
    throw new Error('Failed to remove friend');
  }
  
  return response.json();
};

/**
 * Search users
 */
export const searchUsers = async (query) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/friends/search?q=${encodeURIComponent(query)}`, { headers });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    throw new Error('Failed to search users');
  }
  
  return response.json();
};
