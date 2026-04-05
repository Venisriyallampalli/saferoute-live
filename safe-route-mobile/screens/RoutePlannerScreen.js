import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, ActivityIndicator, Alert, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  MapPin, Navigation as RouteIndicator, ArrowLeft, ShieldCheck, 
  Compass, MessageSquare, Share2, TriangleAlert, AlertTriangle, X, Zap, ArrowRight
} from 'lucide-react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from '../components/MapContainer';
import { useTheme } from '../context/ThemeContext';
import GlobalHeader from '../components/GlobalHeader';
import { TRANSPORT_MODES, fetchRoute, geocodeDestination, fetchPlaceSuggestions } from '../services/navigationService';
import { scoreRoutesWithBackend, getScoreColor, getDynamicRescoreKey, getSegmentColorBySafety } from '../services/routeSafetyService';
import * as Location from 'expo-location';
import { reverseGeocodeCoords } from '../services/locationService';

const { width, height } = Dimensions.get('window');

const TRANSPORT_OPTIONS = [
  { key: TRANSPORT_MODES.HEAVY, label: 'Truck/Bus/Lorry' },
  { key: TRANSPORT_MODES.CAR, label: 'Car' },
  { key: TRANSPORT_MODES.BIKE, label: 'Bike' },
  { key: TRANSPORT_MODES.CYCLE, label: 'Cycle' },
  { key: TRANSPORT_MODES.WALK, label: 'Walk' },
];

function getTransportModeLabel(mode) {
  const found = TRANSPORT_OPTIONS.find((item) => item.key === mode);
  return found?.label || 'Car';
}

export default function RoutePlannerScreen({ navigation }) {
  const { theme, colors } = useTheme();
  const mapRef = useRef(null);
  
  // View States: 'input' | 'selection'
  const [currentStep, setCurrentStep] = useState('input');

  // Planning States
  const [sourceInput, setSourceInput] = useState('My Location');
  const [destinationInput, setDestinationInput] = useState('');
  const [source, setSource] = useState(null);
  const [destination, setDestination] = useState(null);
  const [allRoutes, setAllRoutes] = useState([]);
  const [transportMode, setTransportMode] = useState(TRANSPORT_MODES.CAR);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isRouting, setIsRouting] = useState(false);
  const [region, setRegion] = useState(null);
  const [routeScoresById, setRouteScoresById] = useState({});
  const [isScoringRoutes, setIsScoringRoutes] = useState(false);
  const [lastScoreUpdateAt, setLastScoreUpdateAt] = useState(null);
  const lastDynamicKeyRef = useRef('');
  
  // Suggestions State
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const getCurrentLocation = async () => {
    setIsSearching(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location access is required to use this feature.');
        return;
      }

      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const point = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      
      setSource(point);

      const address = await reverseGeocodeCoords(point.latitude, point.longitude);
      setSourceInput(address || 'My Location');
      setRegion({
        ...point,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
    } catch (error) {
      Alert.alert('Error', 'Could not retrieve your location.');
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const refreshRouteScores = async (routes, options = {}) => {
    if (!Array.isArray(routes) || !routes.length) {
      setRouteScoresById({});
      return;
    }

    if (!options.silent) {
      setIsScoringRoutes(true);
    }

    try {
      const scored = await scoreRoutesWithBackend(routes);
      const scoreMap = {};
      scored.forEach((item) => {
        scoreMap[item.route_id] = item;
      });

      setRouteScoresById(scoreMap);
      setLastScoreUpdateAt(new Date().toISOString());
    } catch (error) {
      console.warn('Route score refresh failed', error);
    } finally {
      if (!options.silent) {
        setIsScoringRoutes(false);
      }
    }
  };

  useEffect(() => {
    if (currentStep !== 'selection' || allRoutes.length === 0) {
      return undefined;
    }

    const refreshIfNeeded = async () => {
      const dynamicKey = await getDynamicRescoreKey();
      const changed = dynamicKey !== lastDynamicKeyRef.current;

      if (changed) {
        lastDynamicKeyRef.current = dynamicKey;
        await refreshRouteScores(allRoutes, { silent: true });
        return;
      }

      const lastUpdatedAt = lastScoreUpdateAt ? new Date(lastScoreUpdateAt).getTime() : 0;
      const staleForMs = Date.now() - lastUpdatedAt;
      if (!lastUpdatedAt || staleForMs >= 120000) {
        await refreshRouteScores(allRoutes, { silent: true });
      }
    };

    refreshIfNeeded();

    const intervalId = setInterval(() => {
      refreshIfNeeded();
    }, 30000);

    return () => clearInterval(intervalId);
  }, [currentStep, allRoutes, lastScoreUpdateAt]);

  const handleBuildRoute = async () => {
    if (!destinationInput.trim()) {
      Alert.alert('Destination required', 'Please enter where you want to go.');
      return;
    }

    setIsRouting(true);
    setSuggestions([]); // Clear suggestions
    try {
      const destPoint = destination || await geocodeDestination(destinationInput);
      if (!destPoint) throw new Error("Destination not found.");
      setDestination(destPoint);

      const routes = await fetchRoute(source, destPoint, transportMode);
      setAllRoutes(routes);
      setSelectedRouteIndex(0);
      setCurrentStep('selection'); // Move to Map phase
      await refreshRouteScores(routes);
      
      // Auto-zoom map to show route
      setTimeout(() => {
        if (routes.length > 0 && mapRef.current) {
          mapRef.current.fitToCoordinates(routes[0].coordinates, {
            edgePadding: { top: 100, right: 50, bottom: 350, left: 50 },
            animated: true,
          });
        }
      }, 500);
    } catch (error) {
      Alert.alert('Routing error', error.message);
    } finally {
      setIsRouting(false);
    }
  };

  const handleQueryChange = async (text) => {
    setDestinationInput(text);
    if (text.length > 2) {
      setIsSearching(true);
      try {
        const results = await fetchPlaceSuggestions(text, source); // Pass source location
        setSuggestions(results);
      } catch (e) {
        console.warn('Suggestion error', e);
      } finally {
        setIsSearching(false);
      }
    } else {
      setSuggestions([]);
    }
  };

  const selectSuggestion = (item) => {
    const selectedName = item.placeName || item.description || item.mainText || destinationInput;
    setDestinationInput(selectedName);

    if (Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))) {
      setDestination({
        latitude: Number(item.latitude),
        longitude: Number(item.longitude),
        placeName: selectedName,
      });
    } else {
      setDestination(null);
    }

    setSuggestions([]);
  };

  // --- RENDERING PHASE 1: INPUT FORM ---
  const renderInputForm = () => (
    <ScrollView 
      style={{ backgroundColor: colors.background }} 
      className="flex-1 px-8 pt-6"
      showsVerticalScrollIndicator={false}
    >
      <View className="items-center mb-10">
        <View style={{ backgroundColor: theme.primary + '20' }} className="w-16 h-1 w-1 bg-opacity-20 rounded-full mb-6" />
        <Text style={{ color: colors.text }} className="text-3xl font-black text-center tracking-tighter">
          Where to{"\n"}
          <Text style={{ color: theme.primary }}>Today?</Text>
        </Text>
      </View>

      <View className="gap-y-6 mb-10">
        <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="p-6 rounded-[32px] border shadow-sm">
           <Text style={{ color: colors.textMuted }} className="text-[10px] font-black uppercase tracking-widest ml-1 mb-3">Starting Point</Text>
           <View className="flex-row items-center">
              <MapPin size={22} color={theme.primary} />
              <TextInput 
                style={{ color: colors.text }}
                className="flex-1 ml-4 text-base font-bold"
                value={sourceInput}
                onChangeText={setSourceInput}
                placeholder="Enter source..."
                placeholderTextColor={colors.textMuted}
              />
              <TouchableOpacity 
                onPress={getCurrentLocation}
                className="bg-blue-500/10 p-2 rounded-full"
              >
                 <Compass size={18} color={theme.primary} />
              </TouchableOpacity>
           </View>
        </View>

        <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="p-6 rounded-[32px] border shadow-sm">
          <Text style={{ color: colors.textMuted }} className="text-[10px] font-black uppercase tracking-widest ml-1 mb-3">Mode of Transport</Text>
          <View className="flex-row flex-wrap">
            {TRANSPORT_OPTIONS.map((option) => {
              const selected = transportMode === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => setTransportMode(option.key)}
                  className={`px-4 py-2 rounded-full mr-2 mb-2 border ${selected ? 'border-blue-600' : 'border-slate-200'}`}
                  style={{ backgroundColor: selected ? '#dbeafe' : colors.background }}
                >
                  <Text className={`text-xs font-black ${selected ? 'text-blue-700' : 'text-slate-600'}`}>{option.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="p-6 rounded-[32px] border shadow-sm">
           <Text style={{ color: colors.textMuted }} className="text-[10px] font-black uppercase tracking-widest ml-1 mb-3">Final Destination</Text>
           <View className="flex-row items-center">
              <RouteIndicator size={22} color="#ef4444" />
              <TextInput 
                style={{ color: colors.text }}
                className="flex-1 ml-4 text-base font-bold"
                value={destinationInput}
                onChangeText={handleQueryChange}
                placeholder="Where are you going?"
                placeholderTextColor={colors.textMuted}
                autoFocus={true}
              />
              {isSearching ? (
                 <ActivityIndicator size="small" color={theme.primary} />
              ) : destinationInput.length > 0 ? (
                 <TouchableOpacity onPress={() => { setDestinationInput(''); setSuggestions([]); }}>
                    <X size={18} color={colors.textMuted} />
                 </TouchableOpacity>
              ) : null}
           </View>

           {/* Premium Web-Style Suggestion List */}
           {suggestions.length > 0 && (
             <View 
                style={{ backgroundColor: '#1e293b', maxHeight: 320 }} 
                className="mt-4 rounded-[24px] overflow-hidden shadow-2xl border border-white/10"
             >
                <ScrollView 
                   nestedScrollEnabled={true} 
                   showsVerticalScrollIndicator={true}
                   className="p-1"
                >
                   {suggestions.map((item, idx) => (
                     <TouchableOpacity 
                       key={item.id} 
                       onPress={() => selectSuggestion(item)}
                       className={`p-5 flex-row items-start ${idx !== suggestions.length - 1 ? 'border-b border-white/5' : ''}`}
                     >
                       <View className="bg-blue-500/10 w-9 h-9 rounded-full items-center justify-center mr-4 mt-1">
                          <MapPin size={16} color={theme.primary} />
                       </View>
                       <View className="flex-1">
                          <Text className="text-white font-black text-base tracking-tight mb-1">{item.mainText}</Text>
                          <Text className="text-slate-400 text-xs leading-[18px] font-medium">
                             {item.secondaryText || 'Area details available on selection'}
                          </Text>
                       </View>
                     </TouchableOpacity>
                   ))}
                </ScrollView>
             </View>
           )}
        </View>

        <TouchableOpacity 
          style={{ backgroundColor: theme.primary }}
          className="h-20 rounded-[32px] items-center justify-center shadow-2xl shadow-blue-500/30 flex-row"
          onPress={handleBuildRoute}
          disabled={isRouting}
        >
          {isRouting ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Text className="text-white text-lg font-black uppercase tracking-[4px]">Find Safe Routes</Text>
              <ArrowRight size={20} color="white" className="ml-3" />
            </>
          )}
        </TouchableOpacity>
      </View>

      <View className="items-center opacity-30 px-10">
         <ShieldCheck size={24} color={colors.textMuted} />
         <Text style={{ color: colors.textMuted }} className="text-[10px] text-center font-bold uppercase leading-5 mt-3">
            Your safety is prioritized. Route scoring uses real-time situational data.
         </Text>
      </View>
    </ScrollView>
  );

  // --- RENDERING PHASE 2: ROUTE SELECTION ---
  const renderSelectionView = () => (
    <View className="flex-1 relative">
      <MapView 
        ref={mapRef}
        style={{ flex: 1 }}
        provider={PROVIDER_GOOGLE}
        initialRegion={region}
        showsUserLocation
      >
        {source && (
          <Marker coordinate={source}>
             <View style={{ backgroundColor: theme.primary }} className="p-2 rounded-full border-2 border-white shadow-xl">
                <MapPin size={16} color="white" />
             </View>
          </Marker>
        )}
        {destination && (
          <Marker coordinate={destination}>
             <View className="bg-red-500 p-2 rounded-full border-2 border-white shadow-xl">
                <RouteIndicator size={16} color="white" />
             </View>
          </Marker>
        )}
        {allRoutes[selectedRouteIndex] && (
          <Polyline
            coordinates={allRoutes[selectedRouteIndex].coordinates}
            strokeColor="#33415566"
            strokeWidth={4}
          />
        )}

        {Array.isArray(routeScoresById?.[allRoutes[selectedRouteIndex]?.id]?.segments) &&
          routeScoresById[allRoutes[selectedRouteIndex].id].segments.map((segment) => (
            <Polyline
              key={`${allRoutes[selectedRouteIndex].id}-${segment.segment_id}`}
              coordinates={[segment.start, segment.end]}
              strokeColor={getSegmentColorBySafety(segment.safety_score)}
              strokeWidth={7}
              zIndex={20}
            />
          ))}
      </MapView>

      {/* Header Overlay */}
      <View className="absolute top-4 left-4 right-4 flex-row justify-between items-center pointer-events-box-none">
        <TouchableOpacity 
          style={{ backgroundColor: colors.surface }} 
          className="w-12 h-12 rounded-full items-center justify-center shadow-lg border border-white/10"
          onPress={() => setCurrentStep('input')}
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View 
          style={{ backgroundColor: colors.surface }} 
          className="px-6 py-3 rounded-full shadow-lg border border-white/10 flex-row items-center"
        >
           <Zap size={16} color={theme.primary} />
           <Text style={{ color: colors.text }} className="ml-2 font-black uppercase text-[10px] tracking-widest">Select Route</Text>
        </View>
      </View>

      {/* Fixed Action Sidebar (Right Side) */}
      <View className="absolute right-6 top-[20%] gap-y-4">
        {[
          { icon: Compass, color: theme.primary, action: () => mapRef.current?.animateToRegion(region) },
          { icon: MessageSquare, color: '#10b981', action: () => navigation.navigate('SafetyChat') },
          { icon: Share2, color: '#6366f1', action: () => navigation.navigate('ShareLive') },
          { icon: AlertTriangle, color: '#f59e0b', action: () => navigation.navigate('HazardReport') },
          { icon: TriangleAlert, color: '#ef4444', action: () => navigation.navigate('Sos'), bg: '#ef4444' }
        ].map((btn, i) => (
          <TouchableOpacity 
            key={i}
            style={{ backgroundColor: btn.bg || colors.surface }} 
            className="w-14 h-14 rounded-full items-center justify-center shadow-xl border border-white/10"
            onPress={btn.action}
          >
            <btn.icon size={26} color={btn.bg ? 'white' : btn.color} />
          </TouchableOpacity>
        ))}
      </View>

      {/* Results Bottom Panel */}
      <View className="absolute bottom-10 left-6 right-6">
        {isScoringRoutes && (
          <View className="mb-3 bg-white/90 rounded-full px-4 py-2 self-start border border-slate-200">
            <Text className="text-slate-700 text-[10px] font-black uppercase tracking-wide">Updating safety from weather and live factors...</Text>
          </View>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-x-4 mb-4">
          {allRoutes.map((r, idx) => {
            const scored = routeScoresById[r.id];
            const score = Number(scored?.safety_score ?? 0);
            const label = scored?.safety_label || 'Calculating';
            const scoreColors = getScoreColor(score);
            const modeLabel = getTransportModeLabel(r.transportMode || transportMode);

            return (
              <TouchableOpacity 
                key={r.id}
                style={{ 
                  backgroundColor: idx === selectedRouteIndex ? theme.primary : colors.surface,
                  width: width * 0.7 
                }}
                className="p-6 rounded-[32px] shadow-2xl border border-white/5"
                onPress={() => setSelectedRouteIndex(idx)}
              >
                <View className="flex-row justify-between items-center mb-1">
                  <Text className={`font-black text-lg ${idx === selectedRouteIndex ? 'text-white' : ''}`} style={{ color: idx === selectedRouteIndex ? 'white' : colors.text }}>
                    {idx === 0 ? 'Fastest Path' : `Alternative ${idx}`}
                  </Text>
                  <View style={{ backgroundColor: scoreColors.chipBg }} className="px-3 py-1 rounded-full">
                    <Text style={{ color: scoreColors.chipText }} className="text-[10px] font-black">{score}%</Text>
                  </View>
                </View>

                <View className="flex-row items-center mb-2">
                  <View style={{ backgroundColor: scoreColors.labelBg }} className="px-2 py-1 rounded-md">
                    <Text style={{ color: scoreColors.labelText }} className="text-[10px] font-black uppercase">{label}</Text>
                  </View>
                  <View className={`ml-2 px-2 py-1 rounded-md ${idx === selectedRouteIndex ? 'bg-white/20' : 'bg-slate-100'}`}>
                    <Text className={`text-[10px] font-black uppercase ${idx === selectedRouteIndex ? 'text-white' : 'text-slate-600'}`}>{modeLabel}</Text>
                  </View>
                  <Text className={`ml-2 text-[10px] font-bold ${idx === selectedRouteIndex ? 'text-white/90' : 'text-slate-500'}`}>
                    Safety Score
                  </Text>
                </View>

                <Text className={`font-bold mb-4 opacity-70 ${idx === selectedRouteIndex ? 'text-white' : ''}`} style={{ color: idx === selectedRouteIndex ? 'white' : colors.textMuted }}>
                  {Math.ceil(r.durationSeconds / 60)} min • {(r.distanceMeters / 1000).toFixed(1)} km
                </Text>

                {idx === selectedRouteIndex && (
                  <TouchableOpacity 
                    className="bg-white py-4 rounded-2xl items-center shadow-md shadow-black/20"
                    onPress={() => navigation.navigate('Map', {
                      initialRoute: r,
                      routeSafety: scored || null,
                      allRoutes,
                      scoredRoutes: routeScoresById,
                      scoreUpdatedAt: lastScoreUpdateAt,
                      transportMode,
                    })}
                  >
                    <Text style={{ color: theme.primary }} className="font-black uppercase tracking-widest text-xs">Start Navigation</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
      <GlobalHeader navigation={navigation} />
      {currentStep === 'input' ? renderInputForm() : renderSelectionView()}
    </SafeAreaView>
  );
}
