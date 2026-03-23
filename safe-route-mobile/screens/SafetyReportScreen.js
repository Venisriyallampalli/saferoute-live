import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { 
  AlertTriangle as HazardAlertIcon, 
  Info as InfoIcon, 
  MapPin as PinIcon, 
  UserX as HarassmentIcon, 
  Car as AccidentIcon, 
  ZapOff as LightingIcon, 
  ShieldAlert as UnsafeIcon, 
  Construction as ObstructionIcon 
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { getCurrentLocation, reverseGeocodeCoords } from '../services/locationService';
import { submitHazardReport } from '../services/hazardService';

const hazardTypes = [
  { id: 'harassment', label: 'Harassment', icon: HarassmentIcon },
  { id: 'accident', label: 'Road Accident', icon: AccidentIcon },
  { id: 'lighting', label: 'Poor Lighting', icon: LightingIcon },
  { id: 'unsafe', label: 'Unsafe Area', icon: UnsafeIcon },
  { id: 'obstruction', label: 'Road Obstruction', icon: ObstructionIcon },
];

export default function SafetyReportScreen({ navigation }) {
  const { user } = useAuth();
  const userId = user?.id || user?._id || 'anonymous';

  const [selectedType, setSelectedType] = useState(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationPreview, setLocationPreview] = useState('Tap "Capture My Location" before submit.');
  const [capturedLocation, setCapturedLocation] = useState(null);

  const captureLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Please enable location permissions in your device settings to attach your current coordinates to this report.');
        return;
      }

      const location = await getCurrentLocation();
      const address = await reverseGeocodeCoords(location.latitude, location.longitude);
      setCapturedLocation({ ...location, address });
      setLocationPreview(address || `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`);
    } catch (error) {
      Alert.alert('Location unavailable', error.message || 'Unable to capture your location.');
    }
  };

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('Hazard type required', 'Select the type of hazard first.');
      return;
    }

    if (!capturedLocation) {
      Alert.alert('Location required', 'Capture your location before submitting report.');
      return;
    }

    setIsSubmitting(true);
    try {
      await submitHazardReport(userId, {
        type: selectedType,
        description: description.trim(),
        latitude: capturedLocation.latitude,
        longitude: capturedLocation.longitude,
        address: capturedLocation.address,
      });

      Alert.alert('Report submitted', 'Thanks for reporting. This hazard is now visible in route safety checks.');
      navigation.goBack();
    } catch (error) {
      Alert.alert('Submission failed', error.message || 'Unable to submit report.');
    } finally {
      setIsSubmitting(false);
    }
   };

   return (
    <ScrollView className="flex-1 bg-slate-50">
      <View className="p-6">
        <View className="mb-8">
          <Text className="text-slate-900 text-3xl font-black">Report Hazard</Text>
          <Text className="text-slate-500 font-medium mt-1">Help others by sharing real-time risks</Text>
        </View>

        <View className="bg-amber-50 rounded-3xl p-6 mb-8 border border-amber-100 flex-row items-center">
          <View className="w-12 h-12 bg-amber-100 rounded-2xl items-center justify-center mr-4">
             <InfoIcon size={24} color="#f59e0b" />
          </View>
          <View className="flex-1">
            <Text className="text-amber-800 font-bold">Location Required</Text>
            <Text className="text-amber-600/80 text-xs">Capture your current GPS coordinates to attach this report.</Text>
          </View>
        </View>

        <Text className="text-slate-900 font-bold text-lg mb-4">What did you see?</Text>
        <View className="flex-row flex-wrap justify-between gap-y-4 mb-8">
          {hazardTypes.map((type) => {
            const Icon = type.icon;
            return (
              <TouchableOpacity
                key={type.id}
                className={`w-[48%] p-5 rounded-2xl border-2 items-center tracking-tighter ${
                  selectedType === type.id ? 'bg-blue-600 border-blue-600 shadow-md' : 'bg-white border-slate-100'
                }`}
                onPress={() => setSelectedType(type.id)}
              >
                <View className={`w-10 h-10 rounded-full items-center justify-center mb-2 ${selectedType === type.id ? 'bg-white/20' : 'bg-slate-50'}`}>
                  <Icon size={20} color={selectedType === type.id ? 'white' : '#64748b'} />
                </View>
                <Text className={`font-bold text-center text-xs ${selectedType === type.id ? 'text-white' : 'text-slate-700'}`}>
                  {type.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity className="bg-white border border-slate-100 rounded-2xl p-4 mb-5 flex-row items-center justify-between" onPress={captureLocation}>
          <View className="flex-row items-center flex-1 pr-2">
            <PinIcon size={18} color="#2563eb" />
            <Text className="text-slate-700 font-semibold ml-2">Capture My Location</Text>
          </View>
          <HazardAlertIcon size={18} color="#f59e0b" />
        </TouchableOpacity>

        <View className="bg-white border border-slate-100 rounded-2xl p-4 mb-8">
          <Text className="text-slate-500 text-xs uppercase tracking-widest font-bold mb-2">Captured Location</Text>
          <Text className="text-slate-700 text-sm">{locationPreview}</Text>
        </View>

        <Text className="text-slate-900 font-bold text-lg mb-4">Additional Details</Text>
        <TextInput
          className="bg-white rounded-2xl p-4 border border-slate-100 text-slate-800 text-sm mb-8"
          placeholder="Describe the hazard... (optional)"
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
          textAlignVertical="top"
        />

        <TouchableOpacity
          className={`p-5 rounded-[24px] items-center mt-6 ${
            selectedType && capturedLocation ? 'bg-blue-600 shadow-xl shadow-blue-500/20' : 'bg-slate-200'
          }`}
          disabled={isSubmitting}
          onPress={() => {
            if (!selectedType) {
              Alert.alert('Hazard Type', 'Please select a hazard category first.');
              return;
            }
            if (!capturedLocation) {
              Alert.alert('Location Required', 'Click "Capture My Location" to pin the hazard on the map.');
              return;
            }
            handleSubmit();
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text 
              className={`font-black uppercase tracking-widest text-sm ${selectedType && capturedLocation ? 'text-white' : 'text-slate-400'}`}
            >
              Submit Safety Report
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
