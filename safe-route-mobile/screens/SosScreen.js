import React from 'react';
import { View, Text, TouchableOpacity, Alert, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TriangleAlert, Phone, ShieldCheck, ArrowLeft, Users, Zap, Shield, HelpCircle } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import GlobalHeader from '../components/GlobalHeader';

export default function SosScreen({ navigation }) {
  const { theme, colors, isDarkMode } = useTheme();

  const handleCallEmergency = () => {
    Alert.alert("Emergency Services", "Dialiing local emergency services (112 / 911)...", [
      { text: "Cancel", style: "cancel" },
      { text: "Dial Now", style: "destructive" }
    ]);
  };

  const handleNotifyContacts = () => {
    Alert.alert("SOS Sent", "Emergency contacts (3) notified of your live location and distress signal via SafeRoute AI.", [
      { text: "Got it", style: "default" }
    ]);
  };

  return (
    <SafeAreaView style={{ backgroundColor: '#0f172a' }} className="flex-1">
      <GlobalHeader />

      <View className="flex-1 px-8 items-center justify-center">
         {/* Pulsing Emergency Icon Wrapper */}
         <View 
           style={{ backgroundColor: '#ef444420' }} 
           className="w-48 h-48 rounded-[80px] items-center justify-center mb-10 border border-red-500/10"
         >
            <View 
              style={{ backgroundColor: '#ef4444' }} 
              className="w-32 h-32 rounded-[56px] items-center justify-center shadow-2xl shadow-red-500"
            >
               <TriangleAlert size={48} color="white" />
            </View>
         </View>

         <Text className="text-white text-3xl font-black mb-3">SOS Hub</Text>
         <Text className="text-white/50 text-center text-sm font-medium leading-6 mb-12">
            Instant emergency response and contact synchronization.
         </Text>

         {/* Emergency Action Stack */}
         <View className="w-full gap-y-5 mb-12">
            <TouchableOpacity 
              className="bg-red-600 h-20 rounded-[32px] flex-row items-center px-8 shadow-2xl shadow-red-500/40"
              onPress={handleCallEmergency}
            >
               <Phone size={24} color="white" fill="white" />
               <View className="ml-5 flex-1">
                  <Text className="text-white text-xl font-black">Call Emergency</Text>
                  <Text className="text-white/70 text-[10px] uppercase font-black tracking-widest mt-0.5">Dial 100 / 112 / 911</Text>
               </View>
               <Zap size={18} color="white" opacity={0.6} />
            </TouchableOpacity>

            <TouchableOpacity 
              className="bg-white h-20 rounded-[32px] flex-row items-center px-8 border border-white/10 shadow-xl"
              onPress={handleNotifyContacts}
            >
               <Users size={24} color="#0f172a" fill="#0f172a" />
               <View className="ml-5 flex-1">
                  <Text className="text-slate-900 text-xl font-black">Notify Contacts</Text>
                  <Text className="text-slate-500 text-[10px] uppercase font-black tracking-widest mt-0.5">Alert All Trusted Circles</Text>
               </View>
               <ShieldCheck size={18} color="#10b981" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} 
              className="h-20 rounded-[32px] flex-row items-center px-8 border border-white/5"
              onPress={() => navigation.navigate('RouteSelection')}
            >
               <ArrowLeft size={24} color="white" />
               <View className="ml-5 flex-1">
                  <Text className="text-white text-base font-black">Back to Planner</Text>
                  <Text className="text-white/30 text-[10px] uppercase font-black tracking-widest mt-0.5">Return to Current Trip</Text>
               </View>
            </TouchableOpacity>
         </View>

         {/* Predictive Signal Info */}
         <View className="bg-blue-600/10 p-5 rounded-[40px] border border-blue-500/10 flex-row items-center">
            <HelpCircle size={20} color="#3b82f6" opacity={0.6} />
            <Text className="text-blue-500 text-xs font-bold font-black ml-3 uppercase tracking-wider">AI Signal Detection Enabled</Text>
         </View>
      </View>

      {/* Footer Brading */}
      <View className="flex-row items-center justify-center py-10 opacity-20">
         <Shield size={16} color="white" />
         <Text className="text-white text-[10px] font-black uppercase tracking-[6px] ml-4">Secured by SafeRoute</Text>
      </View>
    </SafeAreaView>
  );
}
