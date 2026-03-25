import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, Dimensions, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Shield, MapPin, Users, Zap, Bell, AlertTriangle, 
  Settings, Terminal, Plus, Clock, Info, ShieldAlert 
} from 'lucide-react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/MapContainer';
import { useTheme } from '../context/ThemeContext';
import GlobalHeader from '../components/GlobalHeader';
import { useSocket } from '../context/SocketContext';

const { width } = Dimensions.get('window');

// Custom circular gauge component using pure CSS/View
const Gauge = ({ value, label, color }) => {
  const size = 100;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  return (
    <View className="items-center justify-center p-4">
      <View style={{ width: size, height: size }} className="items-center justify-center">
        {/* Background Circle */}
        <View 
          style={{ width: size, height: size, borderColor: '#e2e8f080', borderWidth: strokeWidth }} 
          className="rounded-full absolute" 
        />
        {/* Fill (Approximated with Border) */}
        <View 
          style={{ 
            width: size, height: size, 
            borderColor: color, 
            borderWidth: strokeWidth,
            borderTopColor: 'transparent',
            borderRightColor: value > 25 ? color : 'transparent',
            borderBottomColor: value > 50 ? color : 'transparent',
            borderLeftColor: value > 75 ? color : 'transparent',
            transform: [{ rotate: '-45deg' }]
          }} 
          className="rounded-full absolute" 
        />
        <Text className="text-xl font-black">{value}%</Text>
      </View>
      <Text className="text-[10px] font-black uppercase tracking-widest mt-3 opacity-50">{label}</Text>
    </View>
  );
};

export default function DashboardScreen({ navigation }) {
  const { theme, colors } = useTheme();
  const { fusionStats } = useSocket();
  const [showSimulator, setShowSimulator] = useState(false);
  
  // Live Data States
  const crowdDensity = fusionStats?.crowdDensity || 55;
  const trafficFlow = fusionStats?.trafficFlow || 65;
  const [lat, setLat] = useState('17.3850');
  const [lng, setLng] = useState('78.4867');
  const [type, setType] = useState('Accident');

  // Simulations are now handled by the backend heartbeat broadcast, 
  // so we've removed the local setInterval-based randomizer.

  const liveAlerts = [
    { id: 1, type: 'Accident', time: '2m ago', severity: 'High', area: 'Mangalagiri Road' },
    { id: 2, type: 'Traffic', time: '5m ago', severity: 'Medium', area: 'Electronic City' },
    { id: 3, type: 'Hazard', time: '12m ago', severity: 'Low', area: 'Park Street' },
  ];

  const socialFeed = [
    { id: 1, user: 'SafeRoute AI', msg: 'All clear on roads near Mangalagiri Gate.', time: 'Just now' },
    { id: 2, user: 'City Patrol', msg: 'Heavy crowd density detected at Central Mall.', time: '10m ago' },
  ];

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
         <GlobalHeader navigation={navigation} />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Live Safety Map Overview */}
        <View className="h-64 relative">
          <MapView 
            style={{ flex: 1 }} 
            provider={PROVIDER_GOOGLE}
            showsTraffic={true}
            initialRegion={{
               latitude: 17.3850,
               longitude: 78.4867,
               latitudeDelta: 0.1,
               longitudeDelta: 0.1,
            }}
          >
             {liveAlerts.map(alert => (
               <Marker 
                 key={alert.id}
                 coordinate={{ latitude: 17.3850 + (alert.id * 0.01), longitude: 78.4867 + (alert.id * 0.005) }}
                 title={alert.type}
               >
                  <View className="bg-red-500 p-2 rounded-full border-2 border-white">
                     <AlertTriangle size={14} color="white" />
                  </View>
               </Marker>
             ))}
          </MapView>
          <View className="absolute bottom-4 right-4">
             <TouchableOpacity className="bg-white p-3 rounded-full shadow-lg border border-slate-100">
                <MapPin size={20} color={theme.primary} />
             </TouchableOpacity>
          </View>
        </View>

        {/* Real-time Data Fusion Widgets */}
        <View className="px-6 py-6">
           <Text style={{ color: colors.text }} className="text-2xl font-black mb-6">Real-time Data Fusion</Text>
           <View className="flex-row justify-between bg-white/5 p-4 rounded-[40px] border border-slate-100/10">
              <Gauge value={crowdDensity} label="Crowd Density" color="#10b981" />
              <Gauge value={trafficFlow} label="Traffic Flow" color="#f59e0b" />
           </View>
        </View>

        {/* Live Social Feed & Alerts Section */}
        <View className="px-6 mb-8">
           <View className="flex-row justify-between items-center mb-6">
              <Text style={{ color: colors.text }} className="text-xl font-bold">Live Social Feed</Text>
              <TouchableOpacity className="bg-blue-50/10 px-3 py-1.5 rounded-full border border-blue-100/20">
                 <Text className="text-blue-500 font-bold text-[10px] uppercase tracking-wider">Join Chat</Text>
              </TouchableOpacity>
           </View>

           {socialFeed.map(feed => (
             <View key={feed.id} className="flex-row items-center mb-4 bg-slate-50/5 p-4 rounded-3xl border border-slate-50/10">
                <View className="w-10 h-10 bg-slate-900 rounded-full items-center justify-center mr-4">
                    <Shield size={18} color="white" />
                </View>
                <View className="flex-1">
                   <View className="flex-row justify-between mb-1">
                      <Text style={{ color: colors.text }} className="font-black text-sm">{feed.user}</Text>
                      <Text style={{ color: colors.textMuted }} className="text-[10px]">{feed.time}</Text>
                   </View>
                   <Text style={{ color: colors.textMuted }} className="text-xs leading-5">{feed.msg}</Text>
                </View>
             </View>
           ))}

           {/* Live Alerts List */}
           <Text style={{ color: colors.text }} className="text-xl font-bold mt-8 mb-6">Live Events Hub</Text>
           {liveAlerts.map(alert => (
             <View key={alert.id} className="bg-white/5 border border-slate-100/10 rounded-[32px] p-5 mb-4 shadow-sm">
                <View className="flex-row items-center justify-between mb-3">
                   <View className="flex-row items-center">
                      <View className={`w-8 h-8 ${alert.severity === 'High' ? 'bg-red-100' : 'bg-amber-100'} rounded-xl items-center justify-center mr-3`}>
                         <ShieldAlert size={16} color={alert.severity === 'High' ? '#ef4444' : '#f59e0b'} />
                      </View>
                      <Text style={{ color: colors.text }} className="font-black text-base">{alert.type}</Text>
                   </View>
                   <View className="bg-slate-900 px-3 py-1 rounded-full">
                      <Text className="text-white font-black text-[9px] uppercase tracking-widest">{alert.severity}</Text>
                   </View>
                </View>
                <View className="flex-row items-center justify-between px-1">
                   <Text style={{ color: colors.textMuted }} className="text-xs font-bold">{alert.area}</Text>
                   <Text style={{ color: colors.textMuted }} className="text-xs font-medium">{alert.time}</Text>
                </View>
             </View>
           ))}
        </View>

        {/* Admin / Simulator Tools Section */}
        <View className="px-6 py-10 bg-slate-900 rounded-t-[60px] mt-10">
           <View className="flex-row items-center mb-8">
              <Terminal size={24} color={theme.primary} />
              <Text className="text-white text-2xl font-black ml-4">Admin Hub</Text>
           </View>

           <View className="flex-row flex-wrap justify-between gap-y-4">
              <TouchableOpacity 
                className="w-full bg-blue-600 h-16 rounded-[24px] items-center justify-center flex-row shadow-2xl shadow-blue-500"
                onPress={() => Alert.alert("Predictive Alert", "Simulating deep learning safety prediction...")}
              >
                 <Zap size={20} color="white" />
                 <Text className="text-white font-black ml-3 uppercase tracking-widest">Trigger Neural Alert</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={{ backgroundColor: colors.surface + '20' }}
                className="w-full h-16 rounded-[24px] items-center justify-center border border-white/10"
                onPress={() => setShowSimulator(true)}
              >
                 <Text className="text-white font-black uppercase tracking-widest text-sm">Open Event Simulator</Text>
              </TouchableOpacity>
           </View>
        </View>
      </ScrollView>

      {/* Simulator Modal */}
      {showSimulator && (
        <View className="absolute inset-0 bg-black/80 items-center justify-end z-[100]">
           <View className="bg-slate-900 w-full rounded-t-[50px] p-10 shadow-2xl border-t border-white/10">
              <View className="flex-row justify-between items-center mb-10">
                 <Text className="text-white text-2xl font-black">Event Simulator</Text>
                 <TouchableOpacity onPress={() => setShowSimulator(false)}>
                    <X size={24} color="white" />
                 </TouchableOpacity>
              </View>

              <View className="gap-y-6 mb-10">
                 <View>
                    <Text className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-3 ml-2">Coordinates</Text>
                    <View className="flex-row gap-x-4">
                       <TextInput 
                         className="flex-1 bg-white/5 border border-white/10 h-14 rounded-2xl px-5 text-white font-bold"
                         value={lat}
                         onChangeText={setLat}
                         placeholder="Lat"
                       />
                       <TextInput 
                         className="flex-1 bg-white/5 border border-white/10 h-14 rounded-2xl px-5 text-white font-bold"
                         value={lng}
                         onChangeText={setLng}
                         placeholder="Lng"
                       />
                    </View>
                 </View>

                 <View>
                    <Text className="text-white/50 text-[10px] uppercase font-black tracking-widest mb-3 ml-2">Event Characteristics</Text>
                    <View className="bg-white/5 border border-white/10 h-14 rounded-2xl px-5 flex-row items-center justify-between">
                       <Text className="text-white font-bold">{type}</Text>
                       <Terminal size={18} color={theme.primary} />
                    </View>
                 </View>
              </View>

              <TouchableOpacity 
                style={{ backgroundColor: theme.primary }}
                className="h-16 rounded-[24px] items-center justify-center shadow-2xl shadow-blue-500"
                onPress={() => {
                   Alert.alert("Simulating Event", `Type: ${type} at ${lat}, ${lng}`);
                   setShowSimulator(false);
                }}
              >
                 <Text className="text-white font-black uppercase tracking-widest">Inject Live Data Feed</Text>
              </TouchableOpacity>
           </View>
        </View>
      )}
    </SafeAreaView>
  );
}
