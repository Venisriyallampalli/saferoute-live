import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
  Linking,
  Platform,
  Share,
} from 'react-native';
import * as DeviceContacts from 'expo-contacts';
import * as SMS from 'expo-sms';
import { User, Phone, Plus, Pencil, Trash2, Users, X, Check, Navigation } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import {
  addContact,
  deleteContact,
  loadContacts,
  saveContacts,
  updateContact,
} from '../services/contactsService';
import { buildLiveLocationLink, getCurrentLocation, reverseGeocodeCoords } from '../services/locationService';

const emptyForm = {
  id: null,
  name: '',
  phone: '',
  relation: 'Trusted',
};

const MAX_EMERGENCY_CONTACTS = 10;

export default function ContactsScreen() {
  const { user } = useAuth();
  const userId = user?.id || user?._id || 'anonymous';

  const [contacts, setContacts] = useState([]);
  const [hasContactAccess, setHasContactAccess] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showImportPicker, setShowImportPicker] = useState(false);
  const [phoneContacts, setPhoneContacts] = useState([]);
  const [selectedDeviceContacts, setSelectedDeviceContacts] = useState({});
  const [importSearchQuery, setImportSearchQuery] = useState('');
  const [importing, setImporting] = useState(false);
  const [sharingContactId, setSharingContactId] = useState(null);
  const limitReached = contacts.length >= MAX_EMERGENCY_CONTACTS;

  const countLabel = useMemo(() => {
    if (!contacts.length) return 'No emergency contacts';
    if (contacts.length === 1) return '1 emergency contact';
    return `${contacts.length} emergency contacts`;
  }, [contacts.length]);

  const filteredPhoneContacts = useMemo(() => {
    const query = importSearchQuery.trim().toLowerCase();
    if (!query) return phoneContacts;

    return phoneContacts.filter((item) => {
      const name = (item.name || '').toLowerCase();
      const phone = (item.phone || '').toLowerCase();
      return name.includes(query) || phone.includes(query);
    });
  }, [phoneContacts, importSearchQuery]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const permission = await DeviceContacts.requestPermissionsAsync();
        const granted = permission.status === 'granted';
        setHasContactAccess(granted);

        if (!granted) {
          setContacts([]);
          return;
        }

        const items = await loadContacts(userId);
        setContacts(items);
      } catch (error) {
        Alert.alert('Contacts unavailable', error.message || 'Unable to load contacts.');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [userId]);

  const requestContactsPermissionAgain = async () => {
    try {
      const permission = await DeviceContacts.requestPermissionsAsync();
      const granted = permission.status === 'granted';
      setHasContactAccess(granted);

      if (!granted) {
        Alert.alert('Permission denied', 'Contacts access is needed to view and manage emergency contacts.');
        return;
      }

      setLoading(true);
      const items = await loadContacts(userId);
      setContacts(items);
    } catch (error) {
      Alert.alert('Permission check failed', error.message || 'Unable to verify contacts permission.');
    } finally {
      setLoading(false);
    }
  };

  const openAddForm = () => {
    if (contacts.length >= MAX_EMERGENCY_CONTACTS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_EMERGENCY_CONTACTS} emergency contacts.`);
      return;
    }

    setForm(emptyForm);
    setShowForm(true);
  };

  const openEditForm = (contact) => {
    setForm({
      id: contact.id,
      name: contact.name,
      phone: contact.phone,
      relation: contact.relation || 'Trusted',
    });
    setShowForm(true);
  };

  const submitForm = async () => {
    const name = form.name.trim();
    const phone = form.phone.trim();

    if (!name || !phone) {
      Alert.alert('Validation', 'Name and phone are required.');
      return;
    }

    if (!form.id && contacts.length >= MAX_EMERGENCY_CONTACTS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_EMERGENCY_CONTACTS} emergency contacts.`);
      return;
    }

    setSaving(true);
    try {
      const next = form.id
        ? await updateContact(userId, { ...form, name, phone }, contacts)
        : await addContact(userId, { ...form, name, phone }, contacts);

      setContacts(next);
      setShowForm(false);
      setForm(emptyForm);
    } catch (error) {
      Alert.alert('Save failed', error.message || 'Unable to save contact.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (contact) => {
    Alert.alert('Delete contact', `Remove ${contact.name} from emergency contacts?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const next = await deleteContact(userId, contact.id, contacts);
            setContacts(next);
          } catch (error) {
            Alert.alert('Delete failed', error.message || 'Unable to delete contact.');
          }
        },
      },
    ]);
  };

  const importFromPhone = async () => {
    if (contacts.length >= MAX_EMERGENCY_CONTACTS) {
      Alert.alert('Limit reached', `You already have ${MAX_EMERGENCY_CONTACTS} emergency contacts.`);
      return;
    }

    try {
      const permission = await DeviceContacts.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Allow contacts permission to import phone contacts.');
        return;
      }

      const response = await DeviceContacts.getContactsAsync({
        fields: [DeviceContacts.Fields.PhoneNumbers],
        pageSize: 300,
      });

      const importable = (response.data || [])
        .map((item) => {
          const firstNumber = item.phoneNumbers?.find((entry) => entry?.number)?.number;
          if (!firstNumber) return null;

          return {
            key: `device:${item.id}`,
            sourceContactId: item.id,
            name: item.name || 'Imported Contact',
            phone: firstNumber,
            relation: 'Trusted',
          };
        })
        .filter(Boolean);

      if (!importable.length) {
        Alert.alert('No importable contacts', 'Could not find phone contacts with numbers.');
        return;
      }

      setPhoneContacts(importable);
      setSelectedDeviceContacts({});
      setImportSearchQuery('');
      setShowImportPicker(true);
    } catch (error) {
      Alert.alert('Import failed', error.message || 'Unable to import contact right now.');
    }
  };

  const normalizePhone = (value = '') => String(value).replace(/[^+\d]/g, '').trim();

  const toggleDeviceContact = (key) => {
    setSelectedDeviceContacts((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const importSelectedContacts = async () => {
    const selected = phoneContacts.filter((item) => selectedDeviceContacts[item.key]);
    const remainingSlots = Math.max(0, MAX_EMERGENCY_CONTACTS - contacts.length);

    if (!selected.length) {
      Alert.alert('Select contacts', 'Choose at least one contact to import.');
      return;
    }

    if (remainingSlots <= 0) {
      Alert.alert('Limit reached', `You can keep only ${MAX_EMERGENCY_CONTACTS} emergency contacts.`);
      return;
    }

    if (selected.length > remainingSlots) {
      Alert.alert('Selection too large', `You can import only ${remainingSlots} more contact${remainingSlots > 1 ? 's' : ''}.`);
      return;
    }

    setImporting(true);
    try {
      const existingPhoneSet = new Set(contacts.map((item) => normalizePhone(item.phone)).filter(Boolean));
      const next = [...contacts];

      selected.forEach((item) => {
        const normalizedPhone = normalizePhone(item.phone);
        if (!normalizedPhone || existingPhoneSet.has(normalizedPhone)) {
          return;
        }

        existingPhoneSet.add(normalizedPhone);
        next.push({
          id: `device:${item.sourceContactId}:${normalizedPhone}`,
          sourceContactId: item.sourceContactId,
          name: item.name,
          phone: normalizedPhone,
          relation: item.relation || 'Trusted',
        });
      });

      const saved = await saveContacts(userId, next);
      setContacts(saved);
      setShowImportPicker(false);

      const importedCount = saved.length - contacts.length;
      if (importedCount > 0) {
        Alert.alert('Imported', `${importedCount} contact${importedCount > 1 ? 's' : ''} added to emergency contacts.`);
      } else {
        Alert.alert('No new contacts', 'Selected contacts are already in your emergency list.');
      }
    } catch (error) {
      Alert.alert('Import failed', error.message || 'Unable to import selected contacts right now.');
    } finally {
      setImporting(false);
    }
  };

  const shareCurrentLocationToContact = async (contact) => {
    const contactPhone = String(contact?.phone || '').trim();
    if (!contactPhone) {
      Alert.alert('Missing phone number', 'This contact does not have a valid phone number.');
      return;
    }

    setSharingContactId(contact.id);

    try {
      const location = await getCurrentLocation();
      const locationLink = buildLiveLocationLink(location.latitude, location.longitude);
      const place = await reverseGeocodeCoords(location.latitude, location.longitude).catch(() => 'Current location');

      const message = [
        'Hi, sharing my current location via SafeRoute.',
        `Location: ${place}`,
        locationLink,
      ].join('\n');

      const smsAvailable = await SMS.isAvailableAsync();
      if (smsAvailable) {
        await SMS.sendSMSAsync([contactPhone], message);
      } else {
        const encoded = encodeURIComponent(message);
        const smsUrl = Platform.OS === 'ios' ? `sms:${contactPhone}&body=${encoded}` : `sms:${contactPhone}?body=${encoded}`;
        const canOpenSms = await Linking.canOpenURL(smsUrl);

        if (canOpenSms) {
          await Linking.openURL(smsUrl);
        } else {
          await Share.share({ message });
        }
      }

      Alert.alert('Location shared', `Prepared location message for ${contact.name}.`);
    } catch (error) {
      Alert.alert('Share failed', error.message || 'Unable to share current location right now.');
    } finally {
      setSharingContactId(null);
    }
  };

  const renderItem = ({ item }) => {
    const sharing = sharingContactId === item.id;

    return (
      <View className="bg-white rounded-2xl p-4 mb-3 border border-slate-100 flex-row items-center">
        <View className="w-12 h-12 rounded-xl bg-blue-50 items-center justify-center mr-3">
          <User size={22} color="#2563eb" />
        </View>

        <View className="flex-1">
          <Text className="text-slate-900 font-bold text-base">{item.name}</Text>
          <Text className="text-slate-500 text-sm mt-0.5"><Phone size={12} color="#64748b" /> {item.phone}</Text>
          <Text className="text-slate-400 text-xs mt-1">{item.relation || 'Trusted contact'}</Text>
        </View>

        <TouchableOpacity
          className="w-10 h-10 rounded-full bg-blue-50 items-center justify-center mr-2"
          onPress={() => shareCurrentLocationToContact(item)}
          disabled={sharing}
        >
          {sharing ? <ActivityIndicator size="small" color="#2563eb" /> : <Navigation size={16} color="#2563eb" />}
        </TouchableOpacity>

        <TouchableOpacity className="w-10 h-10 rounded-full bg-amber-50 items-center justify-center mr-2" onPress={() => openEditForm(item)}>
          <Pencil size={16} color="#d97706" />
        </TouchableOpacity>

        <TouchableOpacity className="w-10 h-10 rounded-full bg-red-50 items-center justify-center" onPress={() => confirmDelete(item)}>
          <Trash2 size={16} color="#dc2626" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-slate-50 px-6 pt-6">
      <View className="flex-row items-center justify-between mb-5">
        <View>
          <Text className="text-3xl font-black text-slate-900">Contacts</Text>
          <Text className="text-slate-500 mt-1">{countLabel}</Text>
        </View>

        <View className="flex-row">
          <TouchableOpacity
            className={`w-12 h-12 rounded-2xl border items-center justify-center mr-2 ${limitReached ? 'bg-slate-100 border-slate-200' : 'bg-white border-slate-100'}`}
            onPress={importFromPhone}
            disabled={limitReached}
          >
            <Users size={19} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity
            className={`w-12 h-12 rounded-2xl items-center justify-center ${limitReached ? 'bg-blue-300' : 'bg-blue-600'}`}
            onPress={openAddForm}
            disabled={limitReached}
          >
            <Plus size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <Text className="text-slate-400 text-xs font-bold mb-3">{contacts.length}/{MAX_EMERGENCY_CONTACTS} contacts used</Text>
      {limitReached && (
        <Text className="text-amber-700 text-xs font-semibold mb-3">Contact limit reached. Delete one to add a new contact.</Text>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#2563eb" />
        </View>
      ) : hasContactAccess === false ? (
        <View className="flex-1 items-center justify-center px-6">
          <View className="bg-white rounded-2xl p-6 border border-slate-100 items-center w-full">
            <Users size={24} color="#94a3b8" />
            <Text className="text-slate-900 font-bold mt-3">Contacts permission required</Text>
            <Text className="text-slate-500 text-sm mt-1 text-center">
              Please allow contacts access to see and manage your emergency contacts.
            </Text>
            <TouchableOpacity className="mt-4 bg-blue-600 rounded-xl px-5 py-3" onPress={requestContactsPermissionAgain}>
              <Text className="text-white font-bold">Allow Contacts Access</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="bg-white rounded-2xl p-6 border border-slate-100 items-center mt-5">
              <User size={24} color="#94a3b8" />
              <Text className="text-slate-700 font-semibold mt-3">No emergency contacts added</Text>
              <Text className="text-slate-500 text-sm mt-1 text-center">Add trusted people who should receive SOS alerts.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 100 }}
        />
      )}

      <Modal visible={showForm} transparent animationType="slide" onRequestClose={() => setShowForm(false)}>
        <View className="flex-1 justify-end bg-black/30">
          <View className="bg-white rounded-t-3xl p-5">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-slate-900 font-black text-lg">{form.id ? 'Edit Contact' : 'Add Contact'}</Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 text-slate-800 mb-3"
              placeholder="Name"
              value={form.name}
              onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
            />
            <TextInput
              className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 text-slate-800 mb-3"
              placeholder="Phone"
              keyboardType="phone-pad"
              value={form.phone}
              onChangeText={(text) => setForm((prev) => ({ ...prev, phone: text }))}
            />
            <TextInput
              className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 text-slate-800 mb-5"
              placeholder="Relation (e.g. Sister, Friend, Parent)"
              value={form.relation}
              onChangeText={(text) => setForm((prev) => ({ ...prev, relation: text }))}
            />

            <TouchableOpacity
              className={`rounded-xl py-3 items-center ${saving ? 'bg-blue-300' : 'bg-blue-600'}`}
              disabled={saving}
              onPress={submitForm}
            >
              {saving ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-bold">Save Contact</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showImportPicker} transparent animationType="slide" onRequestClose={() => setShowImportPicker(false)}>
        <View className="flex-1 justify-end bg-black/30">
          <View className="bg-white rounded-t-3xl p-5 max-h-[75%]">
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-slate-900 font-black text-lg">Select Contacts</Text>
              <TouchableOpacity onPress={() => setShowImportPicker(false)}>
                <X size={20} color="#64748b" />
              </TouchableOpacity>
            </View>

            <TextInput
              className="bg-slate-50 rounded-xl px-4 py-3 border border-slate-100 text-slate-800 mb-3"
              placeholder="Search contacts by name or phone"
              value={importSearchQuery}
              onChangeText={setImportSearchQuery}
            />

            <ScrollView className="mb-4" showsVerticalScrollIndicator={false}>
              {filteredPhoneContacts.map((item) => {
                const selected = Boolean(selectedDeviceContacts[item.key]);
                return (
                  <TouchableOpacity
                    key={item.key}
                    className={`flex-row items-center justify-between rounded-xl border px-4 py-3 mb-2 ${selected ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'}`}
                    onPress={() => toggleDeviceContact(item.key)}
                  >
                    <View className="flex-1 pr-2">
                      <Text className="text-slate-900 font-semibold">{item.name}</Text>
                      <Text className="text-slate-500 text-sm mt-0.5">{item.phone}</Text>
                    </View>
                    <View className={`w-6 h-6 rounded-full items-center justify-center ${selected ? 'bg-blue-600' : 'bg-slate-200'}`}>
                      {selected ? <Check size={14} color="white" /> : null}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {filteredPhoneContacts.length === 0 && (
                <View className="px-4 py-6 items-center">
                  <Text className="text-slate-500 text-sm">No matching contacts found.</Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity
              className={`rounded-xl py-3 items-center ${importing ? 'bg-blue-300' : 'bg-blue-600'}`}
              disabled={importing}
              onPress={importSelectedContacts}
            >
              {importing ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-bold">Add Selected Contacts</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
