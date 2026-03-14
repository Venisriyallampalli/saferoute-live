import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, TextInput, Modal, ActivityIndicator, Alert } from 'react-native';
import * as DeviceContacts from 'expo-contacts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Phone, Plus, User, Trash2, X, Users } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

const CONTACTS_STORAGE_PREFIX = 'trusted_contacts';

export default function ContactsScreen() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState([]);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importSearch, setImportSearch] = useState('');
  const [hasLoadedContacts, setHasLoadedContacts] = useState(false);

  const contactsStorageKey = useMemo(() => {
    const userId = user?.id || user?._id || 'anonymous';
    return `${CONTACTS_STORAGE_PREFIX}:${userId}`;
  }, [user]);

  useEffect(() => {
    const loadContacts = async () => {
      setHasLoadedContacts(false);
      try {
        const raw = await AsyncStorage.getItem(contactsStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          setContacts(Array.isArray(parsed) ? parsed : []);
        } else {
          setContacts([]);
        }
      } catch {
        setContacts([]);
      } finally {
        setHasLoadedContacts(true);
      }
    };

    loadContacts();
  }, [contactsStorageKey]);

  useEffect(() => {
    if (!hasLoadedContacts) return;

    const saveContacts = async () => {
      try {
        await AsyncStorage.setItem(contactsStorageKey, JSON.stringify(contacts));
      } catch {
        // Keep UI responsive even if persistence fails.
      }
    };

    saveContacts();
  }, [contacts, contactsStorageKey, hasLoadedContacts]);

  const contactCountLabel = useMemo(() => {
    if (contacts.length === 0) return 'No trusted contacts yet';
    if (contacts.length === 1) return '1 trusted contact';
    return `${contacts.length} trusted contacts`;
  }, [contacts.length]);

  const filteredPhoneContacts = useMemo(() => {
    const query = importSearch.trim().toLowerCase();
    if (!query) return phoneContacts;

    return phoneContacts.filter((item) => {
      const nameMatch = item.name.toLowerCase().includes(query);
      const phoneMatch = item.phone.toLowerCase().includes(query);
      return nameMatch || phoneMatch;
    });
  }, [phoneContacts, importSearch]);

  const handleAddContact = () => {
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName || !trimmedPhone) {
      setError('Name and phone number are required.');
      return;
    }

    if (trimmedPhone.replace(/[^0-9]/g, '').length < 7) {
      setError('Please enter a valid phone number.');
      return;
    }

    setContacts((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        name: trimmedName,
        phone: trimmedPhone,
        status: 'Trusted',
      },
    ]);

    setName('');
    setPhone('');
    setError('');
    setShowAddForm(false);
  };

  const handleRemoveContact = (id) => {
    setContacts((prev) => prev.filter((item) => item.id !== id));
  };

  const confirmRemoveContact = (id, contactName) => {
    Alert.alert(
      'Delete contact?',
      `Remove ${contactName} from your trusted contacts?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => handleRemoveContact(id) },
      ]
    );
  };

  const openPhoneContacts = async () => {
    try {
      setImporting(true);
      const permission = await DeviceContacts.requestPermissionsAsync();

      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow contacts permission to import contacts from your phone.');
        return;
      }

      const response = await DeviceContacts.getContactsAsync({
        fields: [DeviceContacts.Fields.PhoneNumbers],
        pageSize: 200,
      });

      const imported = (response.data || [])
        .map((item) => {
          const firstPhone = item.phoneNumbers?.[0]?.number?.trim();
          if (!firstPhone) return null;

          return {
            id: item.id,
            name: item.name || 'Unnamed Contact',
            phone: firstPhone,
          };
        })
        .filter(Boolean);

      if (imported.length === 0) {
        Alert.alert('No contacts found', 'No phone contacts with a valid number were found.');
        return;
      }

      setPhoneContacts(imported);
      setImportSearch('');
      setShowImportModal(true);
    } catch (e) {
      Alert.alert('Import failed', 'Unable to read phone contacts right now.');
    } finally {
      setImporting(false);
    }
  };

  const importOneContact = (pickedContact) => {
    setContacts((prev) => {
      const exists = prev.some(
        (item) => item.phone.replace(/[^0-9]/g, '') === pickedContact.phone.replace(/[^0-9]/g, '')
      );

      if (exists) {
        Alert.alert('Already added', 'This contact is already in your trusted list.');
        return prev;
      }

      return [
        ...prev,
        {
          id: `${Date.now()}-${prev.length}`,
          name: pickedContact.name,
          phone: pickedContact.phone,
          status: 'Trusted',
        },
      ];
    });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity className="bg-white rounded-3xl p-4 mb-4 flex-row items-center border border-slate-100 shadow-sm shadow-slate-200">
      <View className="w-16 h-16 rounded-2xl bg-blue-50 items-center justify-center mr-4">
        <User size={28} color="#3b82f6" />
      </View>

      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <Text className="text-slate-900 font-bold text-lg mr-2">{item.name}</Text>
          <View className={`px-2 py-0.5 rounded-md ${item.status === 'Trusted' ? 'bg-green-100' : 'bg-slate-100'}`}>
            <Text className={`text-[10px] font-bold ${item.status === 'Trusted' ? 'text-green-600' : 'text-slate-500'}`}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text className="text-slate-500 text-sm flex-row items-center">
          <Phone size={12} color="#94a3b8" /> {item.phone}
        </Text>
      </View>

      <View className="flex-row gap-x-2">
        <TouchableOpacity
          className="w-10 h-10 bg-red-50 rounded-full items-center justify-center"
          onPress={() => confirmRemoveContact(item.id, item.name)}
        >
          <Trash2 size={18} color="#ef4444" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-slate-50 px-6 pt-6">
      <View className="flex-row items-center justify-between mb-8">
        <View>
          <Text className="text-slate-900 text-3xl font-black">Contacts</Text>
          <Text className="text-slate-500 font-medium">{contactCountLabel}</Text>
        </View>
        <View className="flex-row gap-x-2">
          <TouchableOpacity
            className="bg-white w-12 h-12 rounded-2xl items-center justify-center border border-slate-100"
            onPress={openPhoneContacts}
            disabled={importing}
          >
            {importing ? <ActivityIndicator size="small" color="#3b82f6" /> : <Users size={20} color="#3b82f6" />}
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-blue-600 w-12 h-12 rounded-2xl items-center justify-center shadow-lg shadow-blue-200"
            onPress={() => {
              setShowAddForm((prev) => !prev);
              setError('');
            }}
          >
            {showAddForm ? <X size={22} color="white" /> : <Plus size={24} color="white" />}
          </TouchableOpacity>
        </View>
      </View>

      {showAddForm && (
        <View className="bg-white p-4 rounded-2xl mb-6 border border-slate-100 shadow-sm">
          <Text className="text-slate-900 font-bold mb-3">Add Contact</Text>
          <TextInput
            className="bg-slate-50 rounded-xl px-4 py-3 text-slate-900 mb-3 border border-slate-100"
            placeholder="Full name"
            value={name}
            onChangeText={setName}
          />
          <TextInput
            className="bg-slate-50 rounded-xl px-4 py-3 text-slate-900 mb-3 border border-slate-100"
            placeholder="Phone number"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          {!!error && <Text className="text-red-500 text-sm mb-3">{error}</Text>}

          <TouchableOpacity className="bg-blue-600 py-3 rounded-xl items-center" onPress={handleAddContact}>
            <Text className="text-white font-bold">Save Contact</Text>
          </TouchableOpacity>
        </View>
      )}

      {contacts.length > 0 && (
        <View className="bg-blue-50 p-4 rounded-2xl mb-6 border border-blue-100">
          <Text className="text-blue-800 text-sm font-semibold mb-1">Sharing Recommendation</Text>
          <Text className="text-blue-600/80 text-xs">Share your live route with a trusted contact before you start night travel.</Text>
        </View>
      )}

      {contacts.length === 0 && (
        <View className="bg-white p-6 rounded-2xl border border-slate-100 mb-6 items-center">
          <User size={30} color="#94a3b8" />
          <Text className="text-slate-700 font-bold mt-3">No Contacts Added</Text>
          <Text className="text-slate-500 text-sm mt-1 text-center">
            Tap the plus button to add trusted contacts.
          </Text>
        </View>
      )}

      <FlatList
        data={contacts}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <Modal
        visible={showImportModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowImportModal(false)}
      >
        <View className="flex-1 bg-black/30 justify-end">
          <View className="bg-white rounded-t-3xl p-5 max-h-[75%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-slate-900 text-lg font-black">Import from Phone</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowImportModal(false);
                  setImportSearch('');
                }}
              >
                <Text className="text-slate-500 font-semibold">Close</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              className="bg-slate-50 rounded-xl px-4 py-3 text-slate-900 mb-3 border border-slate-100"
              placeholder="Search by name or phone"
              value={importSearch}
              onChangeText={setImportSearch}
            />

            <FlatList
              data={filteredPhoneContacts}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View className="bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-2 flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-slate-900 font-semibold" numberOfLines={1}>{item.name}</Text>
                    <Text className="text-slate-500 text-xs mt-1" numberOfLines={1}>{item.phone}</Text>
                  </View>
                  <TouchableOpacity
                    className="bg-blue-600 px-3 py-2 rounded-xl"
                    onPress={() => importOneContact(item)}
                  >
                    <Text className="text-white font-bold text-xs">Add</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View className="py-10 items-center">
                  <Text className="text-slate-500 text-sm">No matching contacts found.</Text>
                </View>
              }
              contentContainerStyle={{ paddingBottom: 12 }}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}
