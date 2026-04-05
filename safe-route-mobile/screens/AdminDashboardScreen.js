import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ShieldAlert, CheckCircle2, RotateCcw, LogOut } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { fetchAdminHazards, updateAdminHazard } from '../services/adminHazardService';

const STATUS_OPTIONS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'resolved', label: 'Resolved' },
];

function formatTimestamp(value) {
  if (!value) return 'Unknown time';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString();
}

function getCoordsText(hazard) {
  const coords = hazard?.location?.coordinates || [];
  const lat = Number(coords[1] ?? hazard.latitude);
  const lng = Number(coords[0] ?? hazard.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return 'Coordinates unavailable';
  }
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export default function AdminDashboardScreen() {
  const { colors } = useTheme();
  const { user, logout } = useAuth();

  const [statusFilter, setStatusFilter] = useState('all');
  const [hazards, setHazards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pendingId, setPendingId] = useState(null);

  const loadHazards = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const result = await fetchAdminHazards(statusFilter);
      setHazards(result);
    } catch (error) {
      Alert.alert('Failed to load hazards', error.message || 'Could not fetch hazard reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadHazards(false);
  }, [loadHazards]);

  const handleToggleHazard = async (hazard) => {
    const nextActive = !hazard?.isActive;
    const hazardId = hazard?._id || hazard?.id;

    if (!hazardId) {
      Alert.alert('Invalid hazard', 'Missing hazard id.');
      return;
    }

    setPendingId(hazardId);
    try {
      const response = await updateAdminHazard(hazardId, { isActive: nextActive });
      const updated = response?.hazard;

      setHazards((prev) => prev.map((item) => {
        const currentId = item?._id || item?.id;
        return currentId === hazardId && updated ? updated : item;
      }));
    } catch (error) {
      Alert.alert('Update failed', error.message || 'Unable to update hazard status.');
    } finally {
      setPendingId(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#0f172a" />
        <Text style={{ color: colors.textMuted }} className="mt-3 font-bold">Loading hazard reports...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
      <View className="px-6 pt-4 pb-3 border-b border-slate-200">
        <View className="flex-row items-center justify-between">
          <View>
            <Text style={{ color: colors.text }} className="text-2xl font-black">Admin Dashboard</Text>
            <Text style={{ color: colors.textMuted }} className="text-xs font-bold mt-1">
              {user?.name || 'Admin'} • Hazard moderation
            </Text>
          </View>
          <TouchableOpacity onPress={logout} className="bg-slate-900 rounded-xl px-4 py-2 flex-row items-center">
            <LogOut size={14} color="#ffffff" />
            <Text className="text-white font-black text-xs ml-2">Logout</Text>
          </TouchableOpacity>
        </View>

        <View className="flex-row mt-4">
          {STATUS_OPTIONS.map((option) => {
            const selected = statusFilter === option.key;
            return (
              <TouchableOpacity
                key={option.key}
                onPress={() => setStatusFilter(option.key)}
                className="mr-2 px-4 py-2 rounded-full"
                style={{ backgroundColor: selected ? '#0f172a' : '#e2e8f0' }}
              >
                <Text style={{ color: selected ? '#ffffff' : '#334155' }} className="font-black text-xs uppercase tracking-widest">
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <ScrollView
        className="flex-1 px-5 pt-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadHazards(true)} />}
      >
        {hazards.length === 0 ? (
          <View className="bg-white border border-slate-200 rounded-2xl p-6 mt-4">
            <Text style={{ color: colors.text }} className="font-black text-base">No hazard reports</Text>
            <Text style={{ color: colors.textMuted }} className="text-sm mt-2">Try changing filters or refresh later.</Text>
          </View>
        ) : (
          hazards.map((hazard) => {
            const hazardId = hazard?._id || hazard?.id;
            const isPending = pendingId === hazardId;
            const isActive = Boolean(hazard?.isActive);

            return (
              <View key={hazardId} className="bg-white border border-slate-200 rounded-2xl p-4 mb-3">
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 pr-3">
                    <Text className="text-slate-900 font-black uppercase tracking-wide">
                      {hazard?.type || 'hazard'} • {hazard?.severity || 'Medium'}
                    </Text>
                    <Text className="text-slate-600 text-xs mt-1">{formatTimestamp(hazard?.createdAt)}</Text>
                  </View>
                  <View className={`px-3 py-1 rounded-full ${isActive ? 'bg-rose-100' : 'bg-emerald-100'}`}>
                    <Text className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {isActive ? 'Active' : 'Resolved'}
                    </Text>
                  </View>
                </View>

                <Text className="text-slate-800 mt-3 text-sm font-medium">{hazard?.address || getCoordsText(hazard)}</Text>
                {hazard?.description ? <Text className="text-slate-600 mt-2 text-xs">{hazard.description}</Text> : null}

                <View className="flex-row items-center mt-4">
                  <TouchableOpacity
                    disabled={isPending}
                    onPress={() => handleToggleHazard(hazard)}
                    className={`px-4 py-2 rounded-xl flex-row items-center ${isActive ? 'bg-emerald-600' : 'bg-amber-500'}`}
                  >
                    {isPending ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : isActive ? (
                      <CheckCircle2 size={14} color="#ffffff" />
                    ) : (
                      <RotateCcw size={14} color="#ffffff" />
                    )}
                    <Text className="text-white text-xs font-black ml-2 uppercase tracking-wider">
                      {isActive ? 'Mark Resolved' : 'Reopen Hazard'}
                    </Text>
                  </TouchableOpacity>

                  <View className="ml-3 flex-row items-center">
                    <ShieldAlert size={14} color="#64748b" />
                    <Text className="text-slate-500 text-xs font-bold ml-1">Source: {hazard?.source || 'mobile'}</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
