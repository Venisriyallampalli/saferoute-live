import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Linking, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TriangleAlert, Phone, ShieldCheck, ArrowLeft, Users, Zap, Shield, HelpCircle, MapPin } from 'lucide-react-native';
import { Audio } from 'expo-av';
import GlobalHeader from '../components/GlobalHeader';
import MapView, { Marker } from '../components/MapContainer';
import { useAuth } from '../context/AuthContext';
import { getCurrentLocation, requestLocationPermission } from '../services/locationService';
import { loadContacts } from '../services/contactsService';
import { notifyContactsBySms, triggerSosAlert, updateSosLocation } from '../services/sosService';

const SIREN_LOCK_MS = 180000; // 3 minutes
const SIREN_AUTO_OFF_MS = 300000; // 5 minutes

export default function SosScreen({ navigation }) {
   const { user } = useAuth();

   const userId = user?.id || user?._id || 'anonymous';
   const trackingTimerRef = useRef(null);
   const sirenTimeoutRef = useRef(null);

   const [isActivating, setIsActivating] = useState(false);
   const [isSosActive, setIsSosActive] = useState(false);
   const [userLocation, setUserLocation] = useState(null);
   const [nearestPolice, setNearestPolice] = useState(null);
   const [smsInfo, setSmsInfo] = useState({ sent: false, count: 0 });
   const [blinkOn, setBlinkOn] = useState(true);
   const [sirenOn, setSirenOn] = useState(false);
   const [sirenLockUntil, setSirenLockUntil] = useState(0);
   const [sirenLockSecondsLeft, setSirenLockSecondsLeft] = useState(0);
   const [countdown, setCountdown] = useState(0);
   const countdownTimerRef = useRef(null);
   const sirenSoundRef = useRef(null);

   useEffect(() => {
      if (!isSosActive) return undefined;

      const blinkTimer = setInterval(() => {
         setBlinkOn((prev) => !prev);
      }, 500);

      return () => clearInterval(blinkTimer);
   }, [isSosActive]);

   useEffect(() => {
      const stopSiren = async () => {
         try {
            if (sirenSoundRef.current) {
               await sirenSoundRef.current.stopAsync();
               await sirenSoundRef.current.unloadAsync();
               sirenSoundRef.current = null;
            }
         } catch (error) {
            // Best-effort cleanup when screen unmounts.
         }
      };

      return () => {
         if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
         }

         stopSiren();

         if (trackingTimerRef.current) {
            clearInterval(trackingTimerRef.current);
         }
      };
   }, []);

   useEffect(() => {
      let cancelled = false;

      const stopSiren = async () => {
         try {
            if (sirenSoundRef.current) {
               await sirenSoundRef.current.stopAsync();
               await sirenSoundRef.current.unloadAsync();
               sirenSoundRef.current = null;
            }
         } catch (error) {
            // Ignore cleanup errors to avoid blocking SOS UI.
         }
      };

      const startSiren = async () => {
         try {
            await Audio.setAudioModeAsync({
               allowsRecordingIOS: false,
               playsInSilentModeIOS: true,
               shouldDuckAndroid: false,
               playThroughEarpieceAndroid: false,
               staysActiveInBackground: true, // Keep audio active in background
            });

            const { sound } = await Audio.Sound.createAsync(
               require('../assets/sounds/siren.wav'),
               {
                  shouldPlay: true,
                  isLooping: true,
                  volume: 1,
               }
            );

            await sound.setVolumeAsync(1);

            if (cancelled) {
               await sound.stopAsync();
               await sound.unloadAsync();
               return;
            }

            sirenSoundRef.current = sound;
         } catch (error) {
            setSirenOn(false);
            Alert.alert('Siren unavailable', 'Could not play siren audio on this device.');
         }
      };

      if (!isSosActive || !sirenOn) {
         stopSiren();
      } else {
         startSiren();
      }

      return () => {
         cancelled = true;
         stopSiren();
      };
   }, [isSosActive, sirenOn]);

   useEffect(() => {
      if (!sirenLockUntil || !isSosActive) {
         setSirenLockSecondsLeft(0);
         return undefined;
      }

      const updateRemaining = () => {
         const remainingMs = Math.max(0, sirenLockUntil - Date.now());
         setSirenLockSecondsLeft(Math.ceil(remainingMs / 1000));
      };

      updateRemaining();
      const timer = setInterval(updateRemaining, 250);

      return () => clearInterval(timer);
   }, [sirenLockUntil, isSosActive]);

   useEffect(() => {
      // Clear any existing auto-off timer when the component unmounts or dependencies change.
      if (sirenTimeoutRef.current) {
         clearTimeout(sirenTimeoutRef.current);
      }

      // If the siren is active, set a new timer to turn it off automatically.
      if (isSosActive && sirenOn) {
         sirenTimeoutRef.current = setTimeout(() => {
            setSirenOn(false);
            // Optionally, alert the user that the siren has been turned off.
            Alert.alert('Siren Deactivated', 'The siren has been automatically turned off after 5 minutes.');
         }, SIREN_AUTO_OFF_MS);
      }

      // Cleanup function to clear the timer.
      return () => {
         if (sirenTimeoutRef.current) {
            clearTimeout(sirenTimeoutRef.current);
         }
      };
   }, [isSosActive, sirenOn]);

   const mapRegion = useMemo(() => {
      if (!userLocation) return null;
      return {
         latitude: userLocation.latitude,
         longitude: userLocation.longitude,
         latitudeDelta: 0.03,
         longitudeDelta: 0.03,
      };
   }, [userLocation]);

   const startLiveTracking = (activeAlertId) => {
      if (trackingTimerRef.current) {
         clearInterval(trackingTimerRef.current);
      }

      trackingTimerRef.current = setInterval(async () => {
         try {
            const latest = await getCurrentLocation();
            setUserLocation({ latitude: latest.latitude, longitude: latest.longitude });

            await updateSosLocation({
               alertId: activeAlertId,
               latitude: latest.latitude,
               longitude: latest.longitude,
               timestamp: new Date().toISOString(),
            });
         } catch (error) {
            // Keep SOS flow alive even if update ping fails.
         }
      }, 5000);
   };

   const activateSos = async () => {
      setIsActivating(true);
      try {
         const permission = await requestLocationPermission();
         if (!permission) {
            Alert.alert('Permission required', 'Location permission is required to activate SOS.');
            return;
         }

         const current = await getCurrentLocation();
         const lat = current.latitude;
         const lon = current.longitude;

         setUserLocation({ latitude: lat, longitude: lon });

         const response = await triggerSosAlert({
            userId,
            latitude: lat,
            longitude: lon,
            timestamp: new Date().toISOString(),
         });

         setNearestPolice(response?.nearest_police || null);
         setSirenLockUntil(Date.now() + SIREN_LOCK_MS);
         // Auto-start siren right after SOS is armed (post-countdown path).
         setSirenOn(true);
         setIsSosActive(true);

         const contacts = await loadContacts(userId).catch(() => []);
         const smsResult = await notifyContactsBySms(contacts, lat, lon).catch(() => ({ sent: false, count: 0 }));
         setSmsInfo(smsResult);

         if (response?.alert_id) {
            startLiveTracking(response.alert_id);
         }

         Alert.alert('SOS Activated', 'Emergency alert sent. Live tracking is now active.');
      } catch (error) {
         Alert.alert('SOS Failed', error.message || 'Could not activate SOS right now.');
      } finally {
         setIsActivating(false);
      }
   };

   const cancelCountdown = () => {
      if (countdownTimerRef.current) {
         clearInterval(countdownTimerRef.current);
         countdownTimerRef.current = null;
      }
      setCountdown(0);
   };

   const startSosCountdown = () => {
      if (isActivating || isSosActive || countdown > 0) return;

      setCountdown(3);

      countdownTimerRef.current = setInterval(() => {
         setCountdown((prev) => {
            if (prev <= 1) {
               if (countdownTimerRef.current) {
                  clearInterval(countdownTimerRef.current);
                  countdownTimerRef.current = null;
               }

               setTimeout(() => {
                  activateSos();
               }, 100);

               return 0;
            }

            return prev - 1;
         });
      }, 1000);
   };

  const handleCallEmergency = () => {
      Alert.alert('Emergency Services', 'Call emergency helpline 100 now?', [
         { text: 'Cancel', style: 'cancel' },
         {
            text: 'Call 100',
            style: 'destructive',
            onPress: async () => {
               const url = 'tel:100';
               const canOpen = await Linking.canOpenURL(url);
               if (canOpen) {
                  await Linking.openURL(url);
               }
            },
         },
    ]);
  };

  const handleNotifyContacts = () => {
      Alert.alert('Confirm SOS', 'Long-press or confirm to trigger emergency SOS now.', [
         { text: 'Cancel', style: 'cancel' },
         { text: 'Activate SOS', style: 'destructive', onPress: startSosCountdown },
      ]);
  };

   const isSirenLocked = isSosActive && sirenLockSecondsLeft > 0;

  return (
    <SafeAreaView style={{ backgroundColor: '#0f172a' }} className="flex-1">
         <GlobalHeader navigation={navigation} />

      <View className="flex-1 px-8 items-center justify-center">
             {/* SOS Trigger */}
             <TouchableOpacity
                style={{ backgroundColor: '#ef444420' }}
                className="w-52 h-52 rounded-[90px] items-center justify-center mb-10 border border-red-500/20"
                onLongPress={startSosCountdown}
                delayLongPress={900}
                onPress={handleNotifyContacts}
                disabled={isActivating}
             >
                  <View
                     style={{ backgroundColor: '#ef4444', opacity: isActivating ? 0.7 : 1 }}
                     className="w-36 h-36 rounded-[60px] items-center justify-center shadow-2xl shadow-red-500"
                  >
                      {isActivating ? <ActivityIndicator color="white" size="large" /> : <TriangleAlert size={52} color="white" />}
                  </View>
             </TouchableOpacity>

         <Text className="text-white text-3xl font-black mb-3">SOS Hub</Text>
         <Text className="text-white/50 text-center text-sm font-medium leading-6 mb-12">
                  Long-press SOS button to trigger emergency flow.
         </Text>

             {isSosActive && (
                  <View className="w-full bg-emerald-500/10 border border-emerald-400/30 rounded-2xl p-4 mb-8">
                     <Text className="text-emerald-300 font-black text-sm uppercase">SOS Activated</Text>
                     <Text className="text-white mt-1 text-sm">
                        Nearest police: {nearestPolice?.name || 'Fallback Police Station'}
                     </Text>
                     <Text className="text-white/80 text-xs mt-1">
                        Distance: {nearestPolice?.distance_m != null ? `${nearestPolice.distance_m} m` : 'Unknown'}
                     </Text>
                     <Text className="text-white/70 text-xs mt-1">
                        SMS notified: {smsInfo?.count || 0} contact(s)
                     </Text>
                  </View>
             )}

         {/* Emergency Action Stack */}
         <View className="w-full gap-y-5 mb-12">
                  <TouchableOpacity
              className="bg-red-600 h-20 rounded-[32px] flex-row items-center px-8 shadow-2xl shadow-red-500/40"
              onPress={handleCallEmergency}
            >
               <Phone size={24} color="white" fill="white" />
               <View className="ml-5 flex-1">
                  <Text className="text-white text-xl font-black">Call Emergency</Text>
                  <Text className="text-white/70 text-[10px] uppercase font-black tracking-widest mt-0.5">Dial Emergency 100</Text>
               </View>
               <Zap size={18} color="white" opacity={0.6} />
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-white h-20 rounded-[32px] flex-row items-center px-8 border border-white/10 shadow-xl"
              onPress={handleNotifyContacts}
                     onLongPress={startSosCountdown}
              delayLongPress={900}
              disabled={isActivating}
            >
               <Users size={24} color="#0f172a" fill="#0f172a" />
               <View className="ml-5 flex-1">
                  <Text className="text-slate-900 text-xl font-black">Trigger SOS</Text>
                  <Text className="text-slate-500 text-[10px] uppercase font-black tracking-widest mt-0.5">GPS + Police + Contacts</Text>
               </View>
               <ShieldCheck size={18} color="#10b981" />
            </TouchableOpacity>

                  <View
                     className="bg-white/95 h-20 rounded-[32px] flex-row items-center px-8 border border-white/10 shadow-xl"
                  >
                     <Zap size={24} color={isSosActive ? (sirenOn ? '#ef4444' : '#64748b') : '#94a3b8'} />
                     <View className="ml-5 flex-1">
                        <Text className="text-slate-900 text-xl font-black">Siren</Text>
                        <Text className="text-slate-500 text-[10px] uppercase font-black tracking-widest mt-0.5">
                           {isSirenLocked
                              ? `Locked ${sirenLockSecondsLeft}s`
                              : (isSosActive ? (sirenOn ? 'On' : 'Off') : 'Enable after SOS')}
                        </Text>
                     </View>
                     <Switch
                        trackColor={{ false: "#767577", true: "#f43f5e" }}
                        thumbColor={sirenOn ? "#ef4444" : "#f4f3f4"}
                        ios_backgroundColor="#3e3e3e"
                        onValueChange={() => {
                           if (isSirenLocked) return;
                           setSirenOn((prev) => !prev);
                        }}
                        value={sirenOn}
                        disabled={!isSosActive || isSirenLocked}
                     />
                  </View>

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

             {mapRegion && (
               <View className="w-full h-56 rounded-3xl overflow-hidden mt-8 border border-white/10">
                  <MapView style={{ flex: 1 }} initialRegion={mapRegion}>
                     {userLocation && blinkOn && (
                        <Marker coordinate={userLocation} title="You">
                           <View className="bg-red-500 p-2 rounded-full border-2 border-white">
                              <TriangleAlert size={16} color="white" />
                           </View>
                        </Marker>
                     )}

                     {nearestPolice?.location?.lat != null && nearestPolice?.location?.lon != null && (
                        <Marker
                           coordinate={{
                              latitude: Number(nearestPolice.location.lat),
                              longitude: Number(nearestPolice.location.lon),
                           }}
                           title={nearestPolice.name || 'Police Station'}
                        >
                           <View className="bg-blue-500 p-2 rounded-full border-2 border-white">
                              <MapPin size={16} color="white" />
                           </View>
                        </Marker>
                     )}
                  </MapView>
               </View>
             )}
      </View>

         {countdown > 0 && (
            <View className="absolute inset-0 bg-black/55 items-center justify-center px-10">
               <View className="bg-white rounded-3xl p-8 items-center w-full">
                  <Text className="text-slate-900 text-lg font-black mb-2">SOS activating in</Text>
                  <Text className="text-red-600 text-6xl font-black mb-4">{countdown}</Text>
                  <TouchableOpacity className="bg-slate-900 rounded-xl px-5 py-3" onPress={cancelCountdown}>
                     <Text className="text-white font-bold">Cancel</Text>
                  </TouchableOpacity>
               </View>
            </View>
         )}

      {/* Footer Brading */}
      <View className="flex-row items-center justify-center py-10 opacity-20">
         <Shield size={16} color="white" />
         <Text className="text-white text-[10px] font-black uppercase tracking-[6px] ml-4">Secured by SafeRoute</Text>
      </View>
    </SafeAreaView>
  );
}
