import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { User, Phone, Settings, ChevronRight, LogOut, ShieldCheck, Heart } from 'lucide-react-native';

export default function ProfileScreen({ navigation }) {
  const { user, logout } = useAuth();
  
  const menuItems = [
    {
      id: 'contacts',
      label: 'Emergency Contacts',
      icon: Heart,
      color: '#ef4444',
      onPress: () => navigation.navigate('Contacts'),
    },
    {
      id: 'settings',
      label: 'Account Settings',
      icon: Settings,
      color: '#64748b',
      onPress: () => navigation.navigate('Settings'),
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="flex-1">
        <View className="p-6">
          <View className="mb-8">
            <Text className="text-slate-900 text-3xl font-black">My Profile</Text>
            <Text className="text-slate-500 font-medium">Manage your personal safety data</Text>
          </View>

          {/* Profile Card */}
          <View className="bg-white rounded-[32px] p-6 mb-8 border border-slate-100 shadow-xl shadow-slate-200/50 items-center">
            <View className="w-24 h-24 rounded-full bg-blue-50 items-center justify-center mb-4 border-4 border-slate-50">
              <User size={48} color="#2563eb" />
            </View>
            <Text className="text-slate-900 text-2xl font-black">{user?.name || 'Explorer'}</Text>
            <Text className="text-slate-500 font-medium mb-4">{user?.email}</Text>
            
            <View className="bg-blue-50 px-4 py-2 rounded-full flex-row items-center">
              <ShieldCheck size={16} color="#2563eb" />
              <Text className="text-blue-700 font-bold ml-2">Verified Safety User</Text>
            </View>
          </View>

          {/* Contact Summary Section */}
          <View className="bg-slate-900 rounded-[28px] p-6 mb-8 shadow-lg">
             <View className="flex-row items-center mb-2">
                <Phone size={20} color="#3b82f6" />
                <Text className="text-white font-bold text-lg ml-3">Primary Phone</Text>
             </View>
             <Text className="text-slate-400 text-base mb-4 font-medium">{user?.phone || 'Not provided'}</Text>
             <View className="h-[1px] bg-slate-800 mb-4" />
             <Text className="text-slate-500 text-xs italic">Used for emergency identification and SOS broadcasting.</Text>
          </View>

          {/* Action Menu */}
          <View className="bg-white rounded-[28px] overflow-hidden border border-slate-100 mb-8 shadow-sm">
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                onPress={item.onPress}
                className={`flex-row items-center justify-between p-5 ${index !== menuItems.length - 1 ? 'border-b border-slate-50' : ''}`}
              >
                <View className="flex-row items-center">
                  <View className="w-10 h-10 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: `${item.color}15` }}>
                     <item.icon size={20} color={item.color} />
                  </View>
                  <Text className="text-slate-800 font-bold text-base">{item.label}</Text>
                </View>
                <ChevronRight size={18} color="#94a3b8" />
              </TouchableOpacity>
            ))}
          </View>

          {/* Logout */}
          <TouchableOpacity 
            className="flex-row items-center justify-center p-5 bg-red-50 rounded-2xl border border-red-100"
            onPress={logout}
          >
            <LogOut size={20} color="#ef4444" />
            <Text className="text-red-500 font-black ml-2 uppercase tracking-widest">Sign Out</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
