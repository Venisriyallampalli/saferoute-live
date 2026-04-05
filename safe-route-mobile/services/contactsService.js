import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './apiClient';
import { CONTACTS_KEY_PREFIX } from '../utils/storageKeys';

const DEFAULT_EMERGENCY_CONTACTS = [
  {
    id: 'default:police-100',
    name: 'Police',
    phone: '100',
    relation: 'Emergency Service',
  },
  {
    id: 'default:ambulance-108',
    name: 'Ambulance',
    phone: '108',
    relation: 'Emergency Service',
  },
];

function normalizePhone(phone = '') {
  return String(phone).replace(/[^+\d]/g, '').trim();
}

function makeContactId(contact) {
  if (contact.id || contact._id) {
    return String(contact.id || contact._id);
  }

  if (contact.sourceContactId && contact.phone) {
    return `device:${contact.sourceContactId}:${normalizePhone(contact.phone)}`;
  }

  if (contact.phone) {
    return `phone:${normalizePhone(contact.phone)}`;
  }

  return `manual:${Date.now()}`;
}

function normalizeContact(contact) {
  return {
    id: makeContactId(contact),
    name: (contact.name || '').trim(),
    phone: normalizePhone(contact.phone || ''),
    relation: (contact.relation || 'Trusted').trim(),
    createdAt: contact.createdAt || new Date().toISOString(),
    sourceContactId: contact.sourceContactId || null,
  };
}

function getContactsStorageKey(userId = 'anonymous') {
  return `${CONTACTS_KEY_PREFIX}:${userId}`;
}

async function readCachedContacts(userId = 'anonymous') {
  const key = getContactsStorageKey(userId);
  const cached = await AsyncStorage.getItem(key);
  if (!cached) return [];

  try {
    const parsed = JSON.parse(cached);
    return Array.isArray(parsed) ? parsed.map(normalizeContact) : [];
  } catch {
    return [];
  }
}

async function seedDefaultsIfEmpty(userId = 'anonymous', contacts = []) {
  if (Array.isArray(contacts) && contacts.length > 0) {
    return contacts;
  }

  const key = getContactsStorageKey(userId);
  const seeded = DEFAULT_EMERGENCY_CONTACTS.map((item) => normalizeContact(item));
  await AsyncStorage.setItem(key, JSON.stringify(seeded));
  return seeded;
}

export async function loadContacts(userId = 'anonymous') {
  const key = getContactsStorageKey(userId);
  const cachedContacts = await readCachedContacts(userId);

  try {
    const remote = await apiRequest('/api/contacts');
    if (!remote?.synced) {
      throw new Error(remote?.message || 'Contacts are not synced with server');
    }

    const contacts = Array.isArray(remote?.contacts) ? remote.contacts.map(normalizeContact) : [];
    await AsyncStorage.setItem(key, JSON.stringify(contacts));

    return contacts;
  } catch {
    return seedDefaultsIfEmpty(userId, cachedContacts);
  }
}

export async function saveContacts(userId = 'anonymous', contacts = []) {
  const key = getContactsStorageKey(userId);
  const normalized = contacts.map(normalizeContact);

  try {
    const remote = await apiRequest('/api/contacts/sync', {
      method: 'POST',
      body: JSON.stringify({ contacts: normalized }),
    });

    if (!remote?.synced) {
      throw new Error(remote?.message || 'Contacts sync failed');
    }

    const syncedContacts = Array.isArray(remote?.contacts)
      ? remote.contacts.map(normalizeContact)
      : normalized;

    await AsyncStorage.setItem(key, JSON.stringify(syncedContacts));
    return syncedContacts;
  } catch {
    await AsyncStorage.setItem(key, JSON.stringify(normalized));
    return normalized;
  }
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
