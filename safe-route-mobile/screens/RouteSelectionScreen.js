import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ChevronDown, Shield, Info, MapPin, Navigation, ArrowLeft, CheckCircle2, ShieldCheck } from 'lucide-react-native';
import * as Location from 'expo-location';
import { fetchRoute, geocodeDestination, fetchPlaceSuggestions, getMockSafetyMarkers } from '../services/navigationService';
import { calculateSafetyScore, getSafetyLabel } from '../utils/safetyScore';

export default function RouteSelectionScreen({ navigation }) {
  const [sourceInput, setSourceInput] = useState('My Location');
  const [destinationInput, setDestinationInput] = useState('');
  const [source, setSource] = useState(null);
  const [destination, setDestination] = useState(null);
  const [allRoutes, setAllRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isRouting, setIsRouting] = useState(false);
  const [safetyPreference, setSafetyPreference] = useState('Well-lit');
  const [showPreferences, setShowPreferences] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [activeInput, setActiveInput] = useState(null);
  const [debounceTimer, setDebounceTimer] = useState(null);
  const [origin, setOrigin] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const current = await Location.getCurrentPositionAsync({});
        const point = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };
        setOrigin(point);
        setSource(point);
      }
    })();
  }, []);

  const handleInputChange = (text, type) => {
    if (type === 'source') setSourceInput(text);
    else setDestinationInput(text);

    setActiveInput(type);

    if (debounceTimer) clearTimeout(debounceTimer);

    if (text.length > 2) {
      const timer = setTimeout(async () => {
        try {
          const results = await fetchPlaceSuggestions(text);
          setSuggestions(results);
        } catch (error) {
          console.error('Suggestions error:', error);
        }
      }, 500);
      setDebounceTimer(timer);
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = async (item) => {
    if (activeInput === 'source') {
      setSourceInput(item.mainText);
      const coords = await geocodeDestination(item.placeName || item.mainText);
      if (coords) setSource(coords);
    } else {
      setDestinationInput(item.mainText);
      const coords = await geocodeDestination(item.placeName || item.mainText);
      if (coords) setDestination(coords);
    }
    setSuggestions([]);
    setActiveInput(null);
  };

  const handleBuildRoute = async () => {
    const startPoint = sourceInput === 'My Location' ? origin : source;
    
    if (!startPoint || !destination) {
      Alert.alert('Missing Info', 'Please provide both source and destination.');
      return;
    }

    setIsRouting(true);
    try {
      const routes = await fetchRoute(startPoint, destination);
      if (routes && routes.length > 0) {
        setAllRoutes(routes);
      } else {
        Alert.alert('No Route Found', 'Could not find a path between these locations.');
      }
    } catch (error) {
      Alert.alert('Routing Error', 'Failed to calculate routes.');
    } finally {
      setIsRouting(false);
    }
  };

  const markers = origin ? getMockSafetyMarkers(origin) : { hazards: [], policeStations: [], hospitals: [] };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-row items-center px-4 py-4 border-b border-slate-50">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text className="text-xl font-black ml-2 text-slate-900">Plan Safe Trip</Text>
      </View>

      <ScrollView className="flex-1 px-6" showsVerticalScrollIndicator={false}>
        <View className="py-6">
          <View className="gap-y-4 mb-6">
            <View>
              <Text className="text-slate-500 text-[10px] font-bold uppercase ml-1 mb-1">Source</Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                <MapPin size={18} color="#3b82f6" />
                <TextInput
                  className="flex-1 ml-3 text-slate-800 text-sm font-medium"
                  value={sourceInput}
                  onChangeText={(text) => handleInputChange(text, 'source')}
                  placeholder="From..."
                />
              </View>
              {activeInput === 'source' && suggestions.length > 0 && (
                <View className="bg-white rounded-2xl shadow-xl border border-slate-100 mt-2 max-h-40 overflow-hidden z-50">
                  {suggestions.map((item) => (
                    <TouchableOpacity key={item.id} className="px-4 py-3 border-b border-slate-50" onPress={() => selectSuggestion(item)}>
                      <Text className="text-slate-800 text-xs font-bold">{item.mainText}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View>
              <Text className="text-slate-500 text-[10px] font-bold uppercase ml-1 mb-1">Destination</Text>
              <View className="flex-row items-center bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3">
                <Navigation size={18} color="#ef4444" />
                <TextInput
                  className="flex-1 ml-3 text-slate-800 text-sm font-medium"
                  value={destinationInput}
                  onChangeText={(text) => handleInputChange(text, 'destination')}
                  placeholder="Where to?"
                />
              </View>
              {activeInput === 'destination' && suggestions.length > 0 && (
                <View className="bg-white rounded-2xl shadow-xl border border-slate-100 mt-2 max-h-40 overflow-hidden z-50">
                  {suggestions.map((item) => (
                    <TouchableOpacity key={item.id} className="px-4 py-3 border-b border-slate-50" onPress={() => selectSuggestion(item)}>
                      <Text className="text-slate-800 text-xs font-bold">{item.mainText}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View>
              <Text className="text-slate-500 text-[10px] font-bold uppercase ml-1 mb-1">Safety Preference</Text>
              <TouchableOpacity
                className="bg-slate-50 border border-slate-100 rounded-2xl px-4 py-3 flex-row items-center justify-between"
                onPress={() => setShowPreferences(!showPreferences)}
              >
                <Text className="text-slate-800 text-sm font-bold">{safetyPreference}</Text>
                <ChevronDown size={16} color="#64748b" />
              </TouchableOpacity>
              {showPreferences && (
                <View className="bg-white rounded-xl shadow-lg border border-slate-100 mt-2 p-2">
                  {['Well-lit', 'Crowded', 'GPS only', 'Emergency'].map(p => (
                    <TouchableOpacity key={p} className="p-3" onPress={() => { setSafetyPreference(p); setShowPreferences(false); }}>
                      <Text className="text-slate-700 text-sm">{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <TouchableOpacity
              className={`bg-blue-600 h-14 rounded-2xl items-center justify-center shadow-lg shadow-blue-200 mt-2 ${isRouting ? 'opacity-50' : ''}`}
              onPress={handleBuildRoute}
              disabled={isRouting}
            >
              {isRouting ? <ActivityIndicator color="white" /> : <Text className="text-white font-black text-base uppercase tracking-widest">Find Safe Routes</Text>}
            </TouchableOpacity>
          </View>

          {allRoutes.length > 0 && (
            <View className="mt-4">
              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-[2px] mb-4">AI Recommended Routes</Text>
              {allRoutes.map((r, idx) => {
                const score = calculateSafetyScore({ 
                  nearbyHazards: markers.hazards, 
                  nearbyPoliceStations: markers.policeStations, 
                  nearbyHospitals: markers.hospitals, 
                  preference: safetyPreference 
                }) - (idx * 5);
                const label = getSafetyLabel(score);

                return (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => setSelectedRouteIndex(idx)}
                    className={`bg-slate-50 rounded-[24px] p-5 border mb-3 ${idx === selectedRouteIndex ? 'border-blue-600 bg-blue-50/30' : 'border-slate-100'}`}
                  >
                    <View className="flex-row justify-between items-center">
                      <View className="flex-1">
                        <View className="flex-row items-center mb-1">
                          <Text className={`font-black text-lg ${idx === selectedRouteIndex ? 'text-blue-700' : 'text-slate-900'}`}>
                            {idx === 0 ? 'Optimal Path' : `Alternative ${idx}`}
                          </Text>
                          <View className={`ml-2 px-2 py-0.5 rounded-md ${label === 'Safe' ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                             <Text className={`text-[10px] font-black uppercase ${label === 'Safe' ? 'text-emerald-700' : 'text-amber-700'}`}>{label}</Text>
                          </View>
                        </View>
                        <Text className="text-slate-500 text-xs font-bold">
                          {(r.distanceMeters / 1000).toFixed(1)} km • {Math.ceil(r.durationSeconds / 60)} min
                        </Text>
                      </View>
                      
                      <View className="items-end">
                         <View className="bg-slate-900 px-3 py-1 rounded-full mb-1">
                            <Text className="text-white text-[12px] font-black">{score}%</Text>
                         </View>
                         <Text className="text-slate-400 text-[9px] font-bold uppercase">Safety Score</Text>
                      </View>
                    </View>

                    {idx === selectedRouteIndex && (
                      <View className="mt-4 pt-4 border-t border-blue-100 flex-row items-center justify-between">
                        <View className="flex-row items-center">
                          <ShieldCheck size={16} color="#3b82f6" />
                          <Text className="text-blue-600 text-xs font-black ml-1.5 uppercase tracking-wide">AI Verified</Text>
                        </View>
                        <TouchableOpacity
                          className="bg-emerald-600 px-8 py-3 rounded-2xl shadow-md"
                          onPress={() => navigation.navigate('Map', {
                            initialRoute: r,
                            allRoutes: allRoutes,
                            selectedIndex: idx,
                            source: sourceInput === 'My Location' ? origin : source,
                            destination: destination,
                            safetyPreference: safetyPreference
                          })}
                        >
                          <Text className="text-white font-black text-sm uppercase">Start Navigation</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Footer Branding */}
      <View className="p-6 bg-slate-50 flex-row items-center justify-center">
         <Shield size={16} color="#94a3b8" />
         <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-widest ml-2">Secured by SafeRoute AI</Text>
      </View>
    </SafeAreaView>
  );
}
