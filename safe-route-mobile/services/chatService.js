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
 * Get chat messages for a session
 */
export const getChatMessages = async (sessionId, limit = 50, before = null) => {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (before) {
    params.append('before', before);
  }
  
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/chat/${sessionId}?${params}`, { headers });
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication required');
    }
    throw new Error('Failed to fetch messages');
  }
  
  return response.json();
};

/**
 * Send a chat message
 */
export const sendChatMessage = async (sessionId, message, messageType = 'text', location = null) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/chat/${sessionId}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message, messageType, location })
  });
  
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || 'Failed to send message');
  }
  
  return response.json();
};

/**
 * Mark messages as read
 */
export const markMessagesAsRead = async (sessionId) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/chat/${sessionId}/read`, {
    method: 'POST',
    headers
  });
  
  if (!response.ok) {
    throw new Error('Failed to mark messages as read');
  }
  
  return response.json();
};

/**
 * Delete a message
 */
export const deleteMessage = async (messageId) => {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}/api/chat/${messageId}`, {
    method: 'DELETE',
    headers
  });
  
  if (!response.ok) {
    throw new Error('Failed to delete message');
  }
  
  return response.json();
};
