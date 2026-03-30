import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Switch, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Shield, Bell, Eye, UserCircle2, LogOut } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { getDefaultSettings, loadSettings, saveSettings } from '../services/settingsService';
import { LIVE_SHARE_SMS_AUTO_KEY } from '../utils/storageKeys';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const userId = user?.id || user?._id || 'anonymous';

  const [settings, setSettings] = useState(getDefaultSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const consent = await AsyncStorage.getItem(LIVE_SHARE_SMS_AUTO_KEY);
        const loaded = await loadSettings(userId);
        const merged = {
          ...loaded,
          autoSmsShareToTrustedContacts:
            typeof loaded.autoSmsShareToTrustedContacts === 'boolean'
              ? loaded.autoSmsShareToTrustedContacts
              : consent === 'true',
          profile: {
            ...loaded.profile,
            displayName: loaded.profile?.displayName || user?.name || '',
            phone: loaded.profile?.phone || user?.phone || '',
          },
        };
        setSettings(merged);
      } catch (error) {
        Alert.alert('Settings', error.message || 'Failed to load settings.');
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [userId, user]);

  const setToggle = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const setProfileField = (key, value) => {
    setSettings((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        [key]: value,
      },
    }));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await saveSettings(userId, settings);
      await AsyncStorage.setItem(
        LIVE_SHARE_SMS_AUTO_KEY,
        settings.autoSmsShareToTrustedContacts ? 'true' : 'false'
      );
      Alert.alert('Saved', 'Your settings were updated.');
    } catch (error) {
      Alert.alert('Save failed', error.message || 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const userLabel = useMemo(() => settings.profile?.displayName || user?.name || 'SafeRoute User', [settings.profile, user]);

  if (loading) {
    return (
      <View className="flex-1 bg-slate-50 items-center justify-center">
        <ActivityIndicator size="small" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="p-6">
        <Text className="text-slate-900 text-3xl font-black mb-6">Settings</Text>

        <View className="bg-white rounded-3xl overflow-hidden border border-slate-100 mb-7 shadow-sm">
          <View className="p-5 flex-row items-center bg-blue-600">
            <View className="w-14 h-14 rounded-full bg-white/20 items-center justify-center mr-4">
              <UserCircle2 size={32} color="white" />
            </View>
            <View>
              <Text className="text-white font-black text-lg">{userLabel}</Text>
              <Text className="text-blue-100 text-xs">Safety profile</Text>
            </View>
          </View>

          <View className="p-4">
            <Text className="text-slate-600 text-xs font-bold uppercase tracking-widest mb-2">Display Name</Text>
            <TextInput
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-slate-800 mb-3"
              value={settings.profile?.displayName || ''}
              onChangeText={(value) => setProfileField('displayName', value)}
              placeholder="Your name"
            />

            <Text className="text-slate-600 text-xs font-bold uppercase tracking-widest mb-2">Phone</Text>
            <TextInput
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-slate-800 mb-3"
              value={settings.profile?.phone || ''}
              onChangeText={(value) => setProfileField('phone', value)}
              keyboardType="phone-pad"
              placeholder="Emergency phone"
            />

            <Text className="text-slate-600 text-xs font-bold uppercase tracking-widest mb-2">Emergency Note</Text>
            <TextInput
              className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-2 text-slate-800"
              value={settings.profile?.emergencyNote || ''}
              onChangeText={(value) => setProfileField('emergencyNote', value)}
              placeholder="Medical info or special instructions"
              multiline
            />
          </View>
        </View>

        <Text className="text-slate-400 text-xs font-black uppercase tracking-[2px] mb-3 ml-1">Notification Settings</Text>
        <View className="bg-white rounded-3xl overflow-hidden border border-slate-100 mb-6 shadow-sm">
          <View className="px-5 py-4 border-b border-slate-50 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <Bell size={18} color="#2563eb" />
              <Text className="text-slate-700 font-semibold ml-3">Enable Notifications</Text>
            </View>
            <Switch value={settings.notificationsEnabled} onValueChange={(value) => setToggle('notificationsEnabled', value)} />
          </View>

          <View className="px-5 py-4 border-b border-slate-50 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <Shield size={18} color="#dc2626" />
              <Text className="text-slate-700 font-semibold ml-3">High Risk Alerts</Text>
            </View>
            <Switch value={settings.highRiskAlerts} onValueChange={(value) => setToggle('highRiskAlerts', value)} />
          </View>

          <View className="px-5 py-4 border-b border-slate-50 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <Shield size={18} color="#f59e0b" />
              <Text className="text-slate-700 font-semibold ml-3">Automatic SOS</Text>
            </View>
            <Switch value={settings.autoSosEnabled} onValueChange={(value) => setToggle('autoSosEnabled', value)} />
          </View>

          <View className="px-5 py-4 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <Eye size={18} color="#10b981" />
              <Text className="text-slate-700 font-semibold ml-3">Share Live Location by Default</Text>
            </View>
            <Switch value={settings.shareLiveLocationByDefault} onValueChange={(value) => setToggle('shareLiveLocationByDefault', value)} />
          </View>

          <View className="px-5 py-4 border-t border-slate-50 flex-row items-center justify-between">
            <View className="flex-row items-center flex-1">
              <Shield size={18} color="#2563eb" />
              <Text className="text-slate-700 font-semibold ml-3">Auto SMS Share to Trusted Contacts</Text>
            </View>
            <Switch value={settings.autoSmsShareToTrustedContacts} onValueChange={(value) => setToggle('autoSmsShareToTrustedContacts', value)} />
          </View>
        </View>

        <TouchableOpacity className={`rounded-2xl px-5 py-4 mb-4 items-center ${saving ? 'bg-blue-300' : 'bg-blue-600'}`} onPress={saveAll} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="white" /> : <Text className="text-white font-bold">Save Settings</Text>}
        </TouchableOpacity>

        <TouchableOpacity className="bg-red-500 rounded-2xl px-5 py-4 mb-8 flex-row items-center justify-center" onPress={logout}>
          <LogOut size={18} color="white" />
          <Text className="text-white font-bold ml-2">Logout</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
