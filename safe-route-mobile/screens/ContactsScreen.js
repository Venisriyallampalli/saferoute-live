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
} from 'react-native';
import * as DeviceContacts from 'expo-contacts';
import { User, Phone, Plus, Pencil, Trash2, Users, X } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import {
  addContact,
  deleteContact,
  loadContacts,
  updateContact,
} from '../services/contactsService';

const emptyForm = {
  id: null,
  name: '',
  phone: '',
  relation: 'Trusted',
};

export default function ContactsScreen() {
  const { user } = useAuth();
  const userId = user?.id || user?._id || 'anonymous';

  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const countLabel = useMemo(() => {
    if (!contacts.length) return 'No emergency contacts';
    if (contacts.length === 1) return '1 emergency contact';
    return `${contacts.length} emergency contacts`;
  }, [contacts.length]);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
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

  const openAddForm = () => {
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
    try {
      const permission = await DeviceContacts.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Allow contacts permission to import phone contacts.');
        return;
      }

      const response = await DeviceContacts.getContactsAsync({
        fields: [DeviceContacts.Fields.PhoneNumbers],
        pageSize: 100,
      });

      const first = response.data?.find((item) => item.phoneNumbers?.[0]?.number);
      if (!first) {
        Alert.alert('No importable contacts', 'Could not find phone contacts with numbers.');
        return;
      }

      const imported = {
        name: first.name || 'Imported Contact',
        phone: first.phoneNumbers[0].number,
        relation: 'Trusted',
      };

      const next = await addContact(userId, imported, contacts);
      setContacts(next);
      Alert.alert('Imported', `${imported.name} added to emergency contacts.`);
    } catch (error) {
      Alert.alert('Import failed', error.message || 'Unable to import contact right now.');
    }
  };

  const renderItem = ({ item }) => {
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
          <TouchableOpacity className="w-12 h-12 rounded-2xl bg-white border border-slate-100 items-center justify-center mr-2" onPress={importFromPhone}>
            <Users size={19} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity className="w-12 h-12 rounded-2xl bg-blue-600 items-center justify-center" onPress={openAddForm}>
            <Plus size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="small" color="#2563eb" />
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
    </View>
  );
}
