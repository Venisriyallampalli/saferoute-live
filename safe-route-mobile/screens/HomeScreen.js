import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { Map, Users, MessageSquare, AlertTriangle, Settings, Shield, Bell } from 'lucide-react-native';

export default function HomeScreen({ navigation }) {
  const { user } = useAuth();

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 py-4">
          
          {/* 1. App Header */}
          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-slate-900 text-2xl font-black">SafeRoute Live</Text>
            <View className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center">
              <Bell size={20} color="#3b82f6" />
            </View>
          </View>

          {/* 2. Welcome Section */}
          <View className="flex-row items-center justify-between mb-8 bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
            <View>
              <Text className="text-slate-500 text-sm font-medium">Welcome back,</Text>
              <Text className="text-slate-900 text-xl font-bold">{user?.name || 'Explorer'}</Text>
            </View>
            <View className="w-12 h-12 rounded-full bg-blue-100 items-center justify-center">
               <Shield size={24} color="#3b82f6" />
            </View>
          </View>

          {/* 3. Current Safety Status Card */}
          <View className="bg-blue-600 rounded-3xl p-6 mb-8 shadow-lg shadow-blue-200">
            <Text className="text-white/80 text-sm font-medium mb-1 uppercase tracking-wider">Current Status</Text>
            <Text className="text-white text-2xl font-bold mb-6">You are in a Safe Zone</Text>
            <TouchableOpacity 
              className="bg-white py-3.5 rounded-xl items-center shadow-sm"
              onPress={() => navigation.navigate('Map')}
            >
              <Text className="text-blue-600 font-bold">Start Safe Navigation</Text>
            </TouchableOpacity>
          </View>

          {/* 4. Quick Actions Grid */}
          <Text className="text-slate-900 text-lg font-bold mb-4">Quick Actions</Text>
          <View className="flex-row flex-wrap justify-between gap-y-4 mb-8">
            <TouchableOpacity 
              className="w-[48%] bg-white p-5 rounded-3xl shadow-sm border border-slate-100 items-center"
              onPress={() => navigation.navigate('Map')}
            >
              <View className="w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center mb-3">
                <Map size={24} color="#3b82f6" />
              </View>
              <Text className="text-slate-900 font-bold text-sm">Live Map</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              className="w-[48%] bg-white p-5 rounded-3xl shadow-sm border border-slate-100 items-center"
              onPress={() => navigation.navigate('Contacts')}
            >
              <View className="w-12 h-12 bg-green-50 rounded-2xl items-center justify-center mb-3">
                <Users size={24} color="#10b981" />
              </View>
              <Text className="text-slate-900 font-bold text-sm">Contacts</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              className="w-[48%] bg-white p-5 rounded-3xl shadow-sm border border-slate-100 items-center"
              onPress={() => navigation.navigate('Chat')}
            >
              <View className="w-12 h-12 bg-purple-50 rounded-2xl items-center justify-center mb-3">
                <MessageSquare size={24} color="#8b5cf6" />
              </View>
              <Text className="text-slate-900 font-bold text-sm">Safety Chat</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              className="w-[48%] bg-white p-5 rounded-3xl shadow-sm border border-slate-100 items-center"
              onPress={() => navigation.navigate('HazardReport')}
            >
              <View className="w-12 h-12 bg-amber-50 rounded-2xl items-center justify-center mb-3">
                <AlertTriangle size={24} color="#f59e0b" />
              </View>
              <Text className="text-slate-900 font-bold text-sm">Report Hazard</Text>
            </TouchableOpacity>
          </View>

          {/* 5. Emergency SOS Button */}
          <TouchableOpacity 
            className="bg-red-500 p-6 rounded-3xl flex-row items-center justify-center shadow-lg shadow-red-200 mb-6"
            onPress={() => alert('SOS Alert Sent! Your location has been shared with saved contacts.')}
          >
            <Shield size={28} color="white" />
            <Text className="text-white text-xl font-black ml-3">EMERGENCY SOS</Text>
          </TouchableOpacity>

          {/* 6. Settings Section */}
          <TouchableOpacity 
            className="bg-white p-4 rounded-2xl flex-row items-center justify-between border border-slate-100 shadow-sm mb-10"
            onPress={() => navigation.navigate('Settings')}
          >
            <View className="flex-row items-center space-x-3">
              <View className="w-8 h-8 bg-slate-100 rounded-lg items-center justify-center">
                <Settings size={18} color="#64748b" />
              </View>
              <Text className="text-slate-700 font-semibold ml-3">Settings</Text>
            </View>
            <View className="bg-slate-50 px-3 py-1 rounded-full">
              <Text className="text-slate-400 text-xs">→</Text>
            </View>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
