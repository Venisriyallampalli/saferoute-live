import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { Map, Share2, Shield, LayoutDashboard, Zap, Navigation, ArrowRight } from 'lucide-react-native';
import GlobalHeader from '../components/GlobalHeader';

export default function HomeScreen({ navigation }) {
  const { theme, colors, isDarkMode } = useTheme();

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
      <GlobalHeader />
      
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Hero Section */}
        <View className="px-6 py-10 items-center">
          <View 
            style={{ backgroundColor: theme.primary }} 
            className="w-16 h-1 w-1 bg-opacity-20 rounded-full mb-6" 
          />
          <Text 
            style={{ color: colors.text }} 
            className="text-4xl font-black text-center leading-[48px] tracking-tighter"
          >
            Travel Smart.{"\n"}
            <Text style={{ color: theme.primary }}>Travel Safe.</Text>
          </Text>
          <Text 
            style={{ color: colors.textMuted }} 
            className="text-center mt-4 text-sm font-medium leading-6 px-4"
          >
            Your ultimate safety-aware navigation and live tracking system.
          </Text>
        </View>

        {/* Primary Action Buttons */}
        <View className="px-6 gap-y-4 mb-10">
          <TouchableOpacity 
            style={{ backgroundColor: theme.primary }}
            className="flex-row items-center p-6 rounded-[32px] shadow-2xl shadow-blue-300"
            onPress={() => navigation.navigate('RouteSelection')}
          >
            <View className="bg-white/20 p-4 rounded-2xl">
              <Navigation size={28} color="white" />
            </View>
            <View className="ml-5 flex-1">
              <Text className="text-white text-xl font-black">Plan a Route</Text>
              <Text className="text-white/80 text-xs font-bold mt-0.5">Find the safest path to your destination</Text>
            </View>
            <ArrowRight size={20} color="white" />
          </TouchableOpacity>

          <TouchableOpacity 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="flex-row items-center p-6 rounded-[32px] border shadow-sm"
            onPress={() => navigation.navigate('Contacts')}
          >
            <View style={{ backgroundColor: theme.primary + '20' }} className="p-4 rounded-2xl">
              <Share2 size={28} color={theme.primary} />
            </View>
            <View className="ml-5 flex-1">
              <Text style={{ color: colors.text }} className="text-xl font-black">Share Live Location</Text>
              <Text style={{ color: colors.textMuted }} className="text-xs font-bold mt-0.5">Let your loved ones know you're safe</Text>
            </View>
            <ArrowRight size={20} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={{ backgroundColor: colors.surface, borderColor: colors.border }}
            className="flex-row items-center p-6 rounded-[32px] border shadow-sm"
            onPress={() => navigation.navigate('Dashboard')}
          >
            <View style={{ backgroundColor: theme.primary + '15' }} className="p-4 rounded-2xl">
              <LayoutDashboard size={28} color={theme.primary} />
            </View>
            <View className="ml-5 flex-1">
              <Text style={{ color: colors.text }} className="text-xl font-black">View Live Safety Map</Text>
              <Text style={{ color: colors.textMuted }} className="text-xs font-bold mt-0.5">Real-time alerts and crowd density</Text>
            </View>
            <ArrowRight size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Info Cards Section */}
        <View className="px-6 mb-12">
          <Text style={{ color: colors.text }} className="text-2xl font-black mb-6">How it works</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-x-4">
            <View style={{ backgroundColor: colors.surface }} className="w-64 p-6 rounded-[32px] border border-slate-100/10">
              <View style={{ backgroundColor: theme.primary + '20' }} className="w-12 h-12 rounded-2xl items-center justify-center mb-4">
                <Map size={24} color={theme.primary} />
              </View>
              <Text style={{ color: colors.text }} className="text-xl font-black mb-2">Plan</Text>
              <Text style={{ color: colors.textMuted }} className="text-sm font-medium leading-5">
                Calculate routes with real-time safety scores based on history and crowds.
              </Text>
            </View>

            <View style={{ backgroundColor: colors.surface }} className="w-64 p-6 rounded-[32px] border border-slate-100/10">
              <View style={{ backgroundColor: '#10b98120' }} className="w-12 h-12 rounded-2xl items-center justify-center mb-4">
                <Zap size={24} color="#10b981" />
              </View>
              <Text style={{ color: colors.text }} className="text-xl font-black mb-2">Track</Text>
              <Text style={{ color: colors.textMuted }} className="text-sm font-medium leading-5">
                Live location sharing and predictive threat alerts during your journey.
              </Text>
            </View>

            <View style={{ backgroundColor: colors.surface }} className="w-64 p-6 rounded-[32px] border border-slate-100/10">
              <View style={{ backgroundColor: '#f43f5e20' }} className="w-12 h-12 rounded-2xl items-center justify-center mb-4">
                <Shield size={24} color="#f43f5e" />
              </View>
              <Text style={{ color: colors.text }} className="text-xl font-black mb-2">Arrive Safely</Text>
              <Text style={{ color: colors.textMuted }} className="text-sm font-medium leading-5">
                One-tap SOS and immediate emergency contact notification system.
              </Text>
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
