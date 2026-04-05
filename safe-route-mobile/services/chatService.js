import { apiRequest, apiRequestWithFallback } from './apiClient';
import { buildLiveLocationLink } from './locationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CHAT_KEY_PREFIX } from '../utils/storageKeys';

function getChatStorageKey(sessionId) {
  return `${CHAT_KEY_PREFIX}:${sessionId}`;
}

async function loadLocalMessages(sessionId) {
  const raw = await AsyncStorage.getItem(getChatStorageKey(sessionId));
  return raw ? JSON.parse(raw) : [];
}

async function saveLocalMessages(sessionId, messages) {
  await AsyncStorage.setItem(getChatStorageKey(sessionId), JSON.stringify(messages));
}

/**
 * Get chat messages for a session
 */
export const getChatMessages = async (sessionId, limit = 50, before = null) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) {
    params.append('before', before);
  }

  const local = await loadLocalMessages(sessionId);

  const remote = await apiRequestWithFallback(`/api/chat/${sessionId}?${params}`, {}, { messages: local });
  const messages = Array.isArray(remote?.messages) ? remote.messages : local;
  await saveLocalMessages(sessionId, messages);

  return { messages };
};

/**
 * Send a chat message
 */
export const sendChatMessage = async (sessionId, message, messageType = 'text', location = null) => {
  const payload = {
    message,
    messageType,
    location,
  };

  const local = await loadLocalMessages(sessionId);
  const optimisticMessage = {
    _id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    message,
    messageType,
    sender: { _id: 'local-user', name: 'You' },
    senderName: 'You',
    location,
    createdAt: new Date().toISOString(),
    locationLink: location ? buildLiveLocationLink(location.latitude, location.longitude) : null,
  };

  const fallback = { message: optimisticMessage };
  const result = await apiRequestWithFallback(
    `/api/chat/${sessionId}`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    fallback
  );

  const outbound = result?.message || optimisticMessage;
  const aiMessage = result?.aiMessage || null;
  const next = aiMessage ? [...local, outbound, aiMessage] : [...local, outbound];
  await saveLocalMessages(sessionId, next);

  return { message: outbound, aiMessage };
};

/**
 * Mark messages as read
 */
export const markMessagesAsRead = async (sessionId) => {
  return apiRequestWithFallback(
    `/api/chat/${sessionId}/read`,
    {
      method: 'POST',
    },
    { success: true }
  );
};

/**
 * Delete a message
 */
export const deleteMessage = async (messageId) => {
  return apiRequest(`/api/chat/${messageId}`, {
    method: 'DELETE',
  });
};
