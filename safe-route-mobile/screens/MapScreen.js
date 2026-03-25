import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, TextInput, Alert, Platform, StyleSheet, ScrollView } from 'react-native';
import MapView, { Marker, Polyline, UrlTile, PROVIDER_GOOGLE } from '../components/MapContainer';
import * as Location from 'expo-location';
import {
  Shield, Crosshair, AlertTriangle, Building2, ShieldCheck,
  Search, Moon, Sun, Layers, LifeBuoy, Send, Share2,
  ChevronDown, CheckCircle2, Navigation as RouteIcon, MessageSquare, Users, Info,
  Mic, MicOff, Play, Pause, X, CornerUpLeft, CornerUpRight, MoveUp,
  Compass, Volume2, VolumeX, TriangleAlert, Zap, Route
} from 'lucide-react-native';
import * as Speech from 'expo-speech';
import { MAPBOX_TOKEN } from '../utils/config';
import { calculateSafetyScore, getSafetyLabel } from '../utils/safetyScore';
import { fetchRoute, geocodeDestination, getMockSafetyMarkers, fetchPlaceSuggestions } from '../services/navigationService';
import { loadHazardReports } from '../services/hazardService';
import { useAuth } from '../context/AuthContext';
import { createSosPayload, sendSosAlert } from '../services/sosService';
import { loadContacts } from '../services/contactsService';

import { useTheme } from '../context/ThemeContext';

export default function MapScreen({ route, navigation }) {
  const mapRef = useRef(null);
  const { user } = useAuth();
  const { theme, colors, isDarkMode, setIsDarkMode } = useTheme();
  
  const userId = user?.id || user?._id || 'anonymous';

  // ... rest of state
  const [region, setRegion] = useState(null);
  const [origin, setOrigin] = useState(null);
  const [destinationInput, setDestinationInput] = useState('');
  const [destination, setDestination] = useState(null);
  const [allRoutes, setAllRoutes] = useState([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [isLoadingMap, setIsLoadingMap] = useState(true);
  const [isRouting, setIsRouting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const isNavigatingRef = useRef(isNavigating);

  // Voice Navigation States
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isVoiceNavigating, setIsVoiceNavigating] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    isNavigatingRef.current = isNavigating;
  }, [isNavigating]);

  const [sosSending, setSosSending] = useState(false);
  const [markers, setMarkers] = useState({ hospitals: [], policeStations: [], hazards: [] });
  const [errorMessage, setErrorMessage] = useState('');

  // New UI states for web replication
  const [mapType, setMapType] = useState('standard');
  const [safetyPreference, setSafetyPreference] = useState('Well-lit');
  const [showPreferences, setShowPreferences] = useState(false);
  const [source, setSource] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [formCollapsed, setFormCollapsed] = useState(false);

  useEffect(() => {
    let watcher;

    const setupLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setErrorMessage('Location permission denied. Enable GPS permission to use navigation.');
          setIsLoadingMap(false);
          return;
        }

        let current = await Location.getLastKnownPositionAsync();
        if (!current) {
          current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        }

        const currentPoint = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };

        setOrigin(currentPoint);
        setRegion({
          ...currentPoint,
          latitudeDelta: 0.03,
          longitudeDelta: 0.03,
        });

        const localHazards = await loadHazardReports(userId);
        const mock = getMockSafetyMarkers(currentPoint);
        setMarkers({
          hospitals: mock.hospitals,
          policeStations: mock.policeStations,
          hazards: [...mock.hazards, ...localHazards],
        });

        watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 2000,
            distanceInterval: 5,
          },
          (updated) => {
            const newPos = {
              latitude: updated.coords.latitude,
              longitude: updated.coords.longitude,
            };
            setOrigin(newPos);

            // Auto-follow logic in navigation mode
            if (isNavigatingRef.current && mapRef.current) {
              mapRef.current.animateCamera({
                center: newPos,
                pitch: 60,
                heading: updated.coords.heading || 0,
                altitude: 500,
                zoom: 18
              }, { duration: 1000 });
            }
          }
        );
      } catch (error) {
        setErrorMessage(error.message || 'Failed to initialize map');
      } finally {
        setIsLoadingMap(false);
      }
    };

    setupLocationTracking();

    return () => {
      if (watcher) watcher.remove();
    };
  }, [userId]);

  useEffect(() => {
    if (route?.params?.initialRoute) {
      const { initialRoute, allRoutes: incomingRoutes, selectedIndex, source: incSource, destination: incDest, safetyPreference: incPref } = route.params;
      
      setAllRoutes(incomingRoutes || [initialRoute]);
      setSelectedRouteIndex(selectedIndex || 0);
      setSource(incSource);
      setDestination(incDest);
      setSafetyPreference(incPref || 'Well-lit');
      setIsNavigating(true);
      setFormCollapsed(true);
      setShowOptions(false);

      // Start the voice for navigation
      setTimeout(() => {
        handleStartVoiceSession();
      }, 1500);
    }
  }, [route?.params]);

  const safetyScore = useMemo(() => {
    return calculateSafetyScore({
      nearbyHazards: markers.hazards,
      nearbyPoliceStations: markers.policeStations,
      nearbyHospitals: markers.hospitals,
      preference: safetyPreference
    });
  }, [markers, safetyPreference]);

  const safetyLabel = useMemo(() => getSafetyLabel(safetyScore), [safetyScore]);

  const centerOnUser = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Location access is needed to show your current position.');
        return;
      }

      let current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const currentPoint = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setOrigin(currentPoint);

      if (mapRef.current) {
        mapRef.current.animateCamera(
          {
            center: currentPoint,
            pitch: 0,
            heading: 0,
            zoom: 15,
          },
          { duration: 800 }
        );
      }
    } catch (error) {
       Alert.alert('Location Error', 'Unable to retrieve your current location.');
    }
  };

  const activeRoute = useMemo(() => allRoutes[selectedRouteIndex] || null, [allRoutes, selectedRouteIndex]);

  const handleToggleNavigation = () => {
    if (!activeRoute) {
      Alert.alert('No route selected', 'Please enter a destination and find a route first.');
      return;
    }
    const newNavState = !isNavigating;
    setIsNavigating(newNavState);

    if (newNavState) {
      if (activeRoute?.coordinates?.length > 1) {
        // Zoom closer for navigation
        mapRef.current?.animateCamera({
          center: activeRoute.coordinates[0],
          pitch: 60,
          heading: 0,
          altitude: 1000,
          zoom: 17
        }, { duration: 1500 });
      }
      setCurrentStepIndex(0);
      setIsVoiceNavigating(true);
      
      if (voiceEnabled) {
        let textToSpeak = "Starting navigation mode. Please proceed to the highlighted route.";
        if (activeRoute?.steps?.length > 0 && activeRoute.steps[0].maneuver?.instruction) {
          textToSpeak = "Starting your route. " + activeRoute.steps[0].maneuver.instruction;
        }

        Speech.speak(textToSpeak, {
          rate: 0.9,
          pitch: 1.0,
          language: 'en-US',
          onStart: () => console.log('Auto speech started: ', textToSpeak),
          onDone: () => console.log('Auto speech finished successfully.'),
          onError: (error) => console.error('Auto speech error: ', error)
        });
      }
    } else {
      Speech.stop();
      setIsVoiceNavigating(false);
      centerOnUser();
    }
  };

  const handleToggleVoice = () => {
    setVoiceEnabled(!voiceEnabled);
    if (voiceEnabled) {
      Speech.stop(); // Stop completely if turned off
    }
  };

  const handleStartVoiceSession = () => {
    if (!isVoiceNavigating) {
      setIsVoiceNavigating(true);
      if (voiceEnabled) {
        let textToSpeak = "Starting navigation mode. Please proceed to the highlighted route.";
        if (activeRoute?.steps?.length > 0 && activeRoute.steps[0].maneuver?.instruction) {
          textToSpeak = "Starting your route. " + activeRoute.steps[0].maneuver.instruction;
        }

        Speech.speak(textToSpeak, {
          rate: 0.9,
          pitch: 1.0,
          language: 'en-US',
          onStart: () => console.log('Speech started: ', textToSpeak),
          onDone: () => console.log('Speech finished successfully.'),
          onError: (error) => console.error('Speech error: ', error)
        });
      }
    } else {
      setIsVoiceNavigating(false);
      Speech.stop();
    }
  };

  const handleEmergencySos = async () => {
    if (sosSending) return;
    setSosSending(true);
    try {
      const contacts = await loadContacts(userId);
      const payload = createSosPayload({
        user,
        location: origin,
        contacts,
      });
      await sendSosAlert(payload);
      Alert.alert('SOS Shared', 'Emergency alert and your live location shared with contacts.');
    } catch (error) {
      Alert.alert('SOS Failed', 'Could not broadcast SOS signal.');
    } finally {
      setSosSending(false);
    }
  };

  if (isLoadingMap) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#2563eb" />
        <Text className="mt-4 text-slate-600 font-medium">Preparing map and navigation...</Text>
      </View>
    );
  }

  if (!region) {
    return (
      <View className="flex-1 items-center justify-center p-6 bg-white">
        <Text className="text-red-500 font-bold mb-2">Map unavailable</Text>
        <Text className="text-slate-600 text-center">{errorMessage || 'Unable to determine your current location.'}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        showsTraffic={true}
        mapType={mapType}
        userInterfaceStyle={isDarkMode ? 'dark' : 'light'}
      >

        {/* Use the specific source point if geocoded, otherwise fallback to GPS origin */}
        {(source || origin) && (
          <Marker
            coordinate={source || origin}
            title={source === null ? 'Your Location' : 'Start Point'}
          >
            <View className="bg-blue-600 p-2 rounded-full border-2 border-white shadow-md">
              <RouteIcon size={14} color="white" />
            </View>
          </Marker>
        )}

        {destination && (
          <Marker
            coordinate={{ latitude: destination.latitude, longitude: destination.longitude }}
            title="Destination"
            description={destination.placeName || 'Selected destination'}
          >
            <View className="bg-red-600 p-2 rounded-full border-2 border-white shadow-md">
              <ShieldCheck size={14} color="white" />
            </View>
          </Marker>
        )}

        {/* Render all routes but highlight selected one */}
        {allRoutes.map((r, idx) => (
          <Polyline
            key={r.id}
            coordinates={r.coordinates}
            strokeColor={idx === selectedRouteIndex ? '#2563eb' : '#94a3b880'}
            strokeWidth={idx === selectedRouteIndex ? 6 : 4}
            zIndex={idx === selectedRouteIndex ? 10 : 1}
            onPress={() => setSelectedRouteIndex(idx)}
            tappable
          />
        ))}

        {markers.hazards.map((hazard) => {
          const isDangerous = ['harassment', 'unsafe', 'accident'].includes(hazard.type);
          return (
            <Marker
              key={`hazard-${hazard.id}`}
              coordinate={{ latitude: hazard.latitude, longitude: hazard.longitude }}
              title={hazard.type?.toUpperCase() || 'Hazard'}
              description={hazard.description || 'Reported hazard'}
            >
              <View className={`${isDangerous ? 'bg-red-500' : 'bg-amber-400'} p-2 rounded-full border-2 border-white shadow-sm`}>
                <AlertTriangle size={14} color="white" />
              </View>
            </Marker>
          );
        })}

        {/* Navigation Voice/Follow vehicle marker */}
        {isNavigating && origin && (
          <Marker
            coordinate={origin}
            anchor={{ x: 0.5, y: 0.5 }}
            flat
          >
            <View className="items-center justify-center">
               {/* Rounded yellow vehicle with blue roof like in the screenshot */}
               <View className="w-8 h-12 bg-yellow-400 rounded-lg border-2 border-yellow-500 items-center justify-start pt-1">
                  <View className="w-5 h-6 bg-blue-300 rounded-md border border-blue-400" />
                  <View className="absolute bottom-1 w-6 h-1 bg-yellow-600 rounded-full opacity-20" />
               </View>
            </View>
          </Marker>
        )}

        {markers.policeStations.map((place) => (
          <Marker
            key={`police-${place.id}`}
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            title={place.name}
            description="Police station"
          >
            <View className="bg-blue-600 p-2 rounded-full border-2 border-white">
              <ShieldCheck size={14} color="white" />
            </View>
          </Marker>
        ))}

        {markers.hospitals.map((place) => (
          <Marker
            key={`hospital-${place.id}`}
            coordinate={{ latitude: place.latitude, longitude: place.longitude }}
            title={place.name}
            description="Hospital"
          >
            <View className="bg-emerald-500 p-2 rounded-full border-2 border-white">
              <Building2 size={14} color="white" />
            </View>
          </Marker>
        ))}
      </MapView>

      {/* TOP NAVIGATION OVERLAY (Google Maps style) */}
      {isNavigating && activeRoute && (
        <View className="absolute top-12 left-4 right-4 z-[2000]">
          <View className="bg-[#005a44] rounded-[24px] p-5 shadow-2xl flex-row items-center justify-between border border-[#004a34]">
            <View className="flex-row items-center flex-1">
               <View className="items-center mr-5">
                  <CornerUpLeft size={42} color="white" />
               </View>
               <View>
                  <Text className="text-white text-3xl font-black tracking-tight">
                    {(activeRoute.steps?.[currentStepIndex]?.distance / 1000).toFixed(1)} km
                  </Text>
                  <View className="bg-yellow-500 px-1.5 py-0.5 rounded-md mt-1 w-12 items-center">
                    <Text className="text-black font-black text-xs">65</Text>
                  </View>
               </View>
            </View>
            <View className="w-12 h-12 bg-white rounded-full items-center justify-center shadow-lg">
               <Zap size={24} color="#3b82f6" fill="#3b82f6" opacity={0.8} />
            </View>
          </View>
        </View>
      )}

      {/* Top Left - Map Mode Toggles */}
      <View className="absolute top-12 left-4 gap-y-2">
        {!isNavigating && (
          <>
            <TouchableOpacity
              className="bg-white/90 px-3 py-2 rounded-xl flex-row items-center border border-slate-200 shadow-sm"
              onPress={() => setMapType(mapType === 'satellite' ? 'standard' : 'satellite')}
            >
              <Layers size={16} color="#475569" />
              <Text className="ml-2 text-slate-700 font-bold text-xs">{mapType === 'satellite' ? 'Standard' : 'Satellite'}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-white/90 px-3 py-2 rounded-xl flex-row items-center border border-slate-200 shadow-sm"
              onPress={() => setIsDarkMode(!isDarkMode)}
            >
              {isDarkMode ? <Sun size={16} color="#f59e0b" /> : <Moon size={16} color="#475569" />}
              <Text className="ml-2 text-slate-700 font-bold text-xs">{isDarkMode ? 'Light' : 'Dark'}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Top Right - My Location Button */}
      {!isNavigating && (
        <View className="absolute top-12 right-4">
          <TouchableOpacity
            className="bg-blue-600 px-4 py-2.5 rounded-xl flex-row items-center shadow-lg border-2 border-white/20"
            onPress={centerOnUser}
          >
            <RouteIcon size={18} color="white" />
            <Text className="ml-2 text-white font-black text-xs uppercase tracking-wider">My Location</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FLOATING SIDEBAR FOR LIVE NAVIGATION */}
      {isNavigating && (
        <View className="absolute right-6 top-[25%] gap-y-5 z-[50]">
          {/* Recenter Button as a high-visibility Puck */}
          <TouchableOpacity 
            style={{ backgroundColor: colors.surface }} 
            className="w-14 h-14 rounded-full items-center justify-center shadow-2xl border border-white/20"
            onPress={centerOnUser}
          >
            <Compass size={28} color="#ef4444" fill={isDarkMode ? '#ef4444' : 'transparent'} />
          </TouchableOpacity>

          {/* Voice Guidance Toggle */}
          <TouchableOpacity 
            style={{ backgroundColor: colors.surface }} 
            className="w-14 h-14 rounded-full items-center justify-center shadow-2xl border border-white/20"
            onPress={handleToggleVoice}
          >
            {voiceEnabled ? <Volume2 size={24} color="#6366f1" /> : <VolumeX size={24} color={colors.textMuted} />}
          </TouchableOpacity>

          {/* Direct SOS from Nav */}
          <TouchableOpacity 
            className="w-14 h-14 bg-red-600 rounded-full items-center justify-center shadow-2xl border border-white/20"
            onPress={() => navigation.navigate('Sos')}
          >
            <TriangleAlert size={26} color="white" />
          </TouchableOpacity>
          
          {/* Hazard Report */}
          <TouchableOpacity 
            style={{ backgroundColor: colors.surface }} 
            className="w-14 h-14 rounded-full items-center justify-center shadow-2xl border border-white/20"
            onPress={() => navigation.navigate('HazardReport')}
          >
            <AlertTriangle size={24} color="#f59e0b" />
          </TouchableOpacity>
          {/* Chat Link */}
          <TouchableOpacity 
            style={{ backgroundColor: colors.surface }} 
            className="w-14 h-14 rounded-full items-center justify-center shadow-2xl border border-white/10"
            onPress={() => navigation.navigate('SafetyChat')}
          >
            <MessageSquare size={24} color="#10b981" />
          </TouchableOpacity>
        </View>
      )}

      {/* TRIP DASHBOARD PANEL (Redesigned) */}
      <View style={{ zIndex: 100 }} className="absolute bottom-10 left-6 right-6">
          {isNavigating && activeRoute && (
            <View style={{ backgroundColor: colors.surface }} className="rounded-[40px] p-8 shadow-2xl border border-white/5">
               {/* Metadata Row */}
               <View className="flex-row items-center justify-between mb-8">
                 <View>
                    <Text className="text-orange-500 text-5xl font-black">
                       {Math.ceil(activeRoute.durationSeconds / 60)} <Text className="text-xl">min</Text>
                    </Text>
                    <View className="flex-row items-center mt-1">
                       <Text style={{ color: colors.textMuted }} className="font-bold">{(activeRoute.distanceMeters / 1000).toFixed(1)} km</Text>
                       <View className="w-1 h-1 bg-slate-300 rounded-full mx-2" />
                       <Text style={{ color: colors.textMuted }} className="font-bold">Arrival: 11:45 AM</Text>
                    </View>
                 </View>

                 <TouchableOpacity 
                   className="w-16 h-16 bg-red-500 rounded-full items-center justify-center shadow-xl"
                   onPress={() => {
                      Alert.alert("End Trip?", "This will stop navigation and safety monitoring.", [
                        { text: "Cancel", style: "cancel" },
                        { text: "End Trip", onPress: () => setIsNavigating(false), style: "destructive" }
                      ]);
                   }}
                 >
                    <X size={32} color="white" />
                 </TouchableOpacity>
               </View>

               {/* Collapsed/Handle indicator */}
               <View style={{ backgroundColor: colors.border }} className="w-12 h-1.5 rounded-full self-center opacity-30" />
            </View>
          )}

          {/* If NOT navigating, show a simple Re-centre button */}
          {!isNavigating && (
            <TouchableOpacity 
              style={{ backgroundColor: colors.surface }}
              className="w-14 h-14 rounded-full items-center justify-center shadow-xl self-end border border-white/10"
              onPress={centerOnUser}
            >
               <Crosshair size={24} color={theme.primary} />
            </TouchableOpacity>
          )}
      </View>


      {/* Preferences Modal (Mock) */}
      {showPreferences && (
        <View className="absolute bottom-[35%] left-10 right-10 bg-white rounded-3xl p-4 shadow-2xl border border-slate-100 z-50">
          <Text className="text-slate-900 font-black mb-3">Safety Preference</Text>
          {['Well-lit', 'Crowded', 'High Security', 'Standard'].map((pref) => (
            <TouchableOpacity
              key={pref}
              className="py-3 border-b border-slate-50 flex-row items-center justify-between"
              onPress={() => {
                setSafetyPreference(pref);
                setShowPreferences(false);
              }}
            >
              <Text className={`font-bold ${safetyPreference === pref ? 'text-blue-600' : 'text-slate-600'}`}>{pref}</Text>
              {safetyPreference === pref && <CheckCircle2 size={16} color="#2563eb" />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
    ...StyleSheet.absoluteFillObject,
  },
});
