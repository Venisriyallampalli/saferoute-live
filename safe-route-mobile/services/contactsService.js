import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequestWithFallback } from './apiClient';
import { CONTACTS_KEY_PREFIX } from '../utils/storageKeys';

function normalizeContact(contact) {
  return {
    id: contact.id || contact._id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: (contact.name || '').trim(),
    phone: (contact.phone || '').trim(),
    relation: (contact.relation || 'Trusted').trim(),
    createdAt: contact.createdAt || new Date().toISOString(),
  };
}

function getContactsStorageKey(userId = 'anonymous') {
  return `${CONTACTS_KEY_PREFIX}:${userId}`;
}

export async function loadContacts(userId = 'anonymous') {
  const key = getContactsStorageKey(userId);
  const local = await AsyncStorage.getItem(key);
  const localContacts = local ? JSON.parse(local) : [];

  const remote = await apiRequestWithFallback('/api/contacts', {}, { contacts: localContacts });
  const contacts = Array.isArray(remote?.contacts) ? remote.contacts.map(normalizeContact) : localContacts;

  await AsyncStorage.setItem(key, JSON.stringify(contacts));
  return contacts;
}

export async function saveContacts(userId = 'anonymous', contacts = []) {
  const key = getContactsStorageKey(userId);
  const normalized = contacts.map(normalizeContact);

  await AsyncStorage.setItem(key, JSON.stringify(normalized));

  await apiRequestWithFallback(
    '/api/contacts/sync',
    {
      method: 'POST',
      body: JSON.stringify({ contacts: normalized }),
    },
    { success: true }
  );

  return normalized;
}

export async function addContact(userId, contact, previousContacts = []) {
  const next = [...previousContacts, normalizeContact(contact)];
  return saveContacts(userId, next);
}

export async function updateContact(userId, updatedContact, previousContacts = []) {
  const next = previousContacts.map((contact) => {
    if (contact.id !== updatedContact.id) return contact;
    return normalizeContact({ ...contact, ...updatedContact });
  });

  return saveContacts(userId, next);
}

export async function deleteContact(userId, contactId, previousContacts = []) {
  const next = previousContacts.filter((contact) => contact.id !== contactId);
  return saveContacts(userId, next);
}
