import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getCurrentLocation, reverseGeocodeCoords } from '../services/locationService';
import { submitHazardReport } from '../services/hazardService';

const hazardGroups = [
  {
    title: 'Personal Safety',
    types: [
      { id: 'harassment', label: 'Harassment' },
      { id: 'unsafe', label: 'Unsafe Area' },
      { id: 'theft', label: 'Theft Risk' },
      { id: 'assault', label: 'Assault Risk' },
    ],
  },
  {
    title: 'Road Condition',
    types: [
      { id: 'accident', label: 'Road Accident' },
      { id: 'obstruction', label: 'Road Obstruction' },
      { id: 'pothole', label: 'Pothole' },
      { id: 'construction', label: 'Road Work' },
    ],
  },
  {
    title: 'Visibility/Environment',
    types: [
      { id: 'lighting', label: 'Poor Lighting' },
      { id: 'poor_visibility', label: 'Poor Visibility' },
      { id: 'flooding', label: 'Flooded Road' },
      { id: 'stray_animals', label: 'Stray Animals' },
    ],
  },
];

export default function SafetyReportScreen({ navigation }) {
  const { user } = useAuth();
  const userId = user?.id || user?._id || 'anonymous';

  const [selectedType, setSelectedType] = useState(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [locationPreview, setLocationPreview] = useState('Tap Capture Location before submit.');
  const [capturedLocation, setCapturedLocation] = useState(null);

  const safeGoBack = () => {
    if (navigation && typeof navigation.goBack === 'function') {
      navigation.goBack();
    }
  };

  const captureLocation = async () => {
    try {
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
      safeGoBack();
    } catch (error) {
      Alert.alert('Submission failed', error.message || 'Unable to submit report.');
    } finally {
      setIsSubmitting(false);
    }
   };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.topRow}>
        <TouchableOpacity style={styles.backButton} onPress={safeGoBack}>
          <Text style={styles.backButtonText}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.backLabel}>Back</Text>
      </View>

      <Text style={styles.title}>Report Hazard</Text>
      <Text style={styles.subtitle}>Help others by sharing real-time risks</Text>

      <Text style={styles.sectionTitle}>What did you see?</Text>
      {hazardGroups.map((group) => (
        <View key={group.title} style={styles.typeGroup}>
          <Text style={styles.groupTitle}>{group.title}</Text>
          <View style={styles.typeGrid}>
            {group.types.map((type) => {
              const isSelected = selectedType === type.id;
              return (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.typeCard, isSelected ? styles.typeCardActive : null]}
                  onPress={() => setSelectedType(type.id)}
                >
                  <Text style={[styles.typeLabel, isSelected ? styles.typeLabelActive : null]}>{type.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      <TouchableOpacity style={styles.captureButton} onPress={captureLocation}>
        <Text style={styles.captureButtonText}>Capture Location</Text>
      </TouchableOpacity>

      <View style={styles.locationBox}>
        <Text style={styles.locationTitle}>Captured Location</Text>
        <Text style={styles.locationText}>{locationPreview}</Text>
      </View>

      <Text style={styles.sectionTitle}>Additional Details</Text>
      <TextInput
        style={styles.input}
        placeholder="Describe the hazard (optional)"
        multiline
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
        textAlignVertical="top"
      />

      <TouchableOpacity style={styles.submitButton} disabled={isSubmitting} onPress={handleSubmit}>
        {isSubmitting ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text style={styles.submitText}>Submit Safety Report</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: '#0f172a',
    marginTop: -2,
  },
  backLabel: {
    marginLeft: 10,
    color: '#0f172a',
    fontWeight: '700',
  },
  title: {
    color: '#0f172a',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#475569',
    marginTop: 6,
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
    marginTop: 10,
  },
  typeGroup: {
    marginBottom: 12,
  },
  groupTitle: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  typeCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 10,
  },
  typeCardActive: {
    backgroundColor: '#2563eb',
    borderColor: '#2563eb',
  },
  typeLabel: {
    textAlign: 'center',
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13,
  },
  typeLabelActive: {
    color: '#ffffff',
  },
  captureButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  captureButtonText: {
    color: '#0f172a',
    fontWeight: '700',
    textAlign: 'center',
  },
  locationBox: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  locationTitle: {
    color: '#475569',
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 4,
    fontWeight: '700',
  },
  locationText: {
    color: '#0f172a',
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    marginBottom: 14,
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: {
    color: '#ffffff',
    fontWeight: '800',
  },
});
