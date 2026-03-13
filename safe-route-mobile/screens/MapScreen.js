import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from '../components/MapContainer';
import * as Location from 'expo-location';
import { Shield, Navigation, Crosshair, AlertTriangle } from 'lucide-react-native';

export default function MapScreen() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        setLoading(false);
        return;
      }

      let loc = await Location.getCurrentPositionAsync({});
      setLocation({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      });
      setLoading(false);
    })();
  }, []);

  const centerOnUser = async () => {
    let loc = await Location.getCurrentPositionAsync({});
    setLocation({
      ...location,
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    });
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-4 text-slate-500 font-medium">Initializing Map...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      {location ? (
        <MapView 
          className="flex-1"
          region={location}
          showsUserLocation
          showsMyLocationButton={false}
        >
          <Marker 
            coordinate={{ latitude: location.latitude, longitude: location.longitude }}
            title="Current Location"
          >
            <View className="bg-blue-500 p-2 rounded-full border-2 border-white shadow-lg">
              <Navigation size={16} color="white" />
            </View>
          </Marker>
          
          {/* Mock Hazard Marker */}
          <Marker 
            coordinate={{ latitude: location.latitude + 0.005, longitude: location.longitude + 0.005 }}
            title="Hazard Reported"
            description="Poor lighting area"
          >
             <View className="bg-amber-500 p-2 rounded-full border-2 border-white shadow-lg">
              <AlertTriangle size={16} color="white" />
            </View>
          </Marker>
        </MapView>
      ) : (
        <View className="flex-1 items-center justify-center p-6 text-center">
          <Text className="text-red-500 font-bold mb-2">Location Error</Text>
          <Text className="text-slate-600">{errorMsg || 'Unable to fetch coordinates'}</Text>
        </View>
      )}

      {/* Floating UI Panels */}
      <View className="absolute top-12 left-6 right-6">
        <View className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-xl border border-white/20 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <View className="w-10 h-10 bg-green-100 rounded-full items-center justify-center mr-3">
              <Shield size={20} color="#10b981" />
            </View>
            <View>
              <Text className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">Safety Score</Text>
              <Text className="text-green-600 text-lg font-black">94/100</Text>
            </View>
          </View>
          <View className="h-8 w-[1px] bg-slate-200 mx-2" />
          <View className="flex-1">
            <Text className="text-slate-400 text-[10px] uppercase font-bold tracking-wider">Environment</Text>
            <Text className="text-slate-800 font-bold" numberOfLines={1}>Clear Sky • Low Risk</Text>
          </View>
        </View>
      </View>

      <View className="absolute bottom-10 right-6 space-y-4">
        <TouchableOpacity 
          className="bg-white w-14 h-14 rounded-full items-center justify-center shadow-xl border border-slate-100"
          onPress={centerOnUser}
        >
          <Crosshair size={24} color="#3b82f6" />
        </TouchableOpacity>
        
        <TouchableOpacity 
          className="bg-blue-600 px-6 h-14 rounded-full flex-row items-center justify-center shadow-xl"
          onPress={() => alert('Routing feature initialized...')}
        >
          <Navigation size={20} color="white" />
          <Text className="text-white font-bold ml-2">Find Route</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
