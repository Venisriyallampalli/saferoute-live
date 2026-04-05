import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
   Shield, MapPin, AlertTriangle, ShieldAlert 
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
  
  // Live Data States
  const crowdDensity = fusionStats?.crowdDensity || 55;
  const trafficFlow = fusionStats?.trafficFlow || 65;

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

      </ScrollView>
    </SafeAreaView>
  );
}
