import React, { useState } from 'react';
import { View, Text, Switch, ScrollView, TouchableOpacity } from 'react-native';
import { Shield, Bell, Map, Eye, Lock, ChevronRight, UserCircle2, LogOut } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

export default function SettingsScreen() {
  const { user, logout } = useAuth();

  const [settings, setSettings] = useState({
    location: true,
    nightMode: false,
    autoSOS: true,
    shareWithContacts: true,
    highRiskAlerts: true
  });

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const SettingItem = ({ icon: Icon, label, value, onToggle, color = "#3b82f6" }) => (
    <View className="bg-white px-5 py-4 flex-row items-center justify-between border-b border-slate-50">
      <View className="flex-row items-center flex-1">
        <View className="w-10 h-10 rounded-2xl items-center justify-center mr-4" style={{ backgroundColor: `${color}15` }}>
          <Icon size={20} color={color} />
        </View>
        <Text className="text-slate-700 font-semibold">{label}</Text>
      </View>
      <Switch 
        value={value} 
        onValueChange={onToggle}
        trackColor={{ false: '#e2e8f0', true: color }}
        thumbColor="white"
      />
    </View>
  );

  const LinkItem = ({ icon: Icon, label, subtext, color = "#64748b" }) => (
    <TouchableOpacity className="bg-white px-5 py-4 flex-row items-center justify-between border-b border-slate-50">
      <View className="flex-row items-center flex-1">
        <View className="w-10 h-10 rounded-2xl bg-slate-50 items-center justify-center mr-4">
          <Icon size={20} color={color} />
        </View>
        <View>
          <Text className="text-slate-700 font-semibold">{label}</Text>
          {subtext && <Text className="text-slate-400 text-[10px] font-medium uppercase tracking-widest">{subtext}</Text>}
        </View>
      </View>
      <ChevronRight size={18} color="#cbd5e1" />
    </TouchableOpacity>
  );

  return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="p-6">
        <Text className="text-slate-900 text-3xl font-black mb-6">Settings</Text>

        <View className="bg-white rounded-3xl overflow-hidden border border-slate-100 mb-8 shadow-sm">
           <View className="p-5 flex-row items-center bg-blue-600">
             <View className="w-14 h-14 rounded-full bg-white/20 items-center justify-center mr-4">
                <UserCircle2 size={32} color="white" />
             </View>
             <View>
               <Text className="text-white font-black text-lg">{user?.name || 'SafeRoute User'}</Text>
               <Text className="text-blue-100 text-xs">Premium Safety Member</Text>
             </View>
           </View>
        </View>

        <Text className="text-slate-400 text-xs font-black uppercase tracking-[2px] mb-3 ml-1">Privacy & Tracking</Text>
        <View className="bg-white rounded-3xl overflow-hidden border border-slate-100 mb-8 shadow-sm">
          <SettingItem 
            icon={Map} 
            label="Background Location" 
            value={settings.location} 
            onToggle={() => toggleSetting('location')} 
          />
          <SettingItem 
            icon={Eye} 
            label="Share with Trusted Circle" 
            value={settings.shareWithContacts} 
            onToggle={() => toggleSetting('shareWithContacts')} 
            color="#10b981"
          />
        </View>

        <Text className="text-slate-400 text-xs font-black uppercase tracking-[2px] mb-3 ml-1">Safety Features</Text>
        <View className="bg-white rounded-3xl overflow-hidden border border-slate-100 mb-8 shadow-sm">
          <SettingItem 
            icon={Shield} 
            label="Real-time Safety Alerts" 
            value={settings.highRiskAlerts} 
            onToggle={() => toggleSetting('highRiskAlerts')} 
            color="#ef4444"
          />
          <SettingItem 
            icon={Map} 
            label="Night Safety Routing" 
            value={settings.nightMode} 
            onToggle={() => toggleSetting('nightMode')} 
            color="#8b5cf6"
          />
          <SettingItem 
            icon={Bell} 
            label="Automatic SOS Trigger" 
            value={settings.autoSOS} 
            onToggle={() => toggleSetting('autoSOS')} 
            color="#f59e0b"
          />
        </View>

        <Text className="text-slate-400 text-xs font-black uppercase tracking-[2px] mb-3 ml-1">Account</Text>
        <View className="bg-white rounded-3xl overflow-hidden border border-slate-100 mb-8 shadow-sm">
          <LinkItem icon={Lock} label="Security Passcode" subtext="Not Configured" />
          <LinkItem icon={Shield} label="Manage Trusted Contacts" />
        </View>

        <TouchableOpacity
          className="bg-red-500 rounded-2xl px-5 py-4 mb-8 flex-row items-center justify-center"
          onPress={logout}
        >
          <LogOut size={18} color="white" />
          <Text className="text-white font-bold ml-2">Logout</Text>
        </TouchableOpacity>

        <View className="items-center pb-10">
          <Text className="text-slate-300 text-[10px] font-bold uppercase tracking-widest">SafeRoute Live Mobile v1.0.0</Text>
        </View>
      </View>
    </ScrollView>
  );
}
