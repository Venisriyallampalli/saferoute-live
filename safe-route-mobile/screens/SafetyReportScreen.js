import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Animated } from 'react-native';
import { AlertTriangle, MapPin, Camera, CheckCircle2, Info } from 'lucide-react-native';

const hazardTypes = [
  { id: 'lighting', label: 'Poor Lighting', icon: '💡' },
  { id: 'crime', label: 'Safety Risk', icon: '🚨' },
  { id: 'construction', label: 'Construction', icon: '🚧' },
  { id: 'crowd', label: 'Large Crowd', icon: '👥' },
];

export default function SafetyReportScreen({ navigation }) {
  const [selectedType, setSelectedType] = useState(null);
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = () => {
    if (!selectedType) return alert('Please select a hazard type');
    setIsSubmitting(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsSubmitting(false);
      alert('Thank you! Your report has been crowdsourced.');
      navigation.goBack();
    }, 1500);
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
             <Info size={24} color="#f59e0b" />
          </View>
          <View className="flex-1">
            <Text className="text-amber-800 font-bold">Location Auto-captured</Text>
            <Text className="text-amber-600/80 text-xs">Your current GPS coordinates will be attached to this report.</Text>
          </View>
        </View>

        <Text className="text-slate-900 font-bold text-lg mb-4">What did you see?</Text>
        <View className="flex-row flex-wrap justify-between gap-y-4 mb-8">
          {hazardTypes.map((type) => (
            <TouchableOpacity 
              key={type.id}
              className={`w-[48%] p-5 rounded-2xl border-2 items-center ${
                selectedType === type.id ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-100'
              }`}
              onPress={() => setSelectedType(type.id)}
            >
              <Text className="text-2xl mb-2">{type.icon}</Text>
              <Text className={`font-bold ${selectedType === type.id ? 'text-white' : 'text-slate-700'}`}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
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

        <TouchableOpacity className="bg-slate-200 p-5 rounded-2xl mb-6 flex-row items-center justify-center border border-slate-300">
           <Camera size={20} color="#64748b" className="mr-2" />
           <Text className="text-slate-600 font-bold ml-2">Add Photo Evidence</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          className={`p-5 rounded-2xl items-center shadow-lg ${
            selectedType ? 'bg-blue-600 shadow-blue-200' : 'bg-slate-300 shadow-none'
          }`}
          disabled={!selectedType || isSubmitting}
          onPress={handleSubmit}
        >
          <Text className="text-white font-black text-lg">
            {isSubmitting ? 'Reporting...' : 'SUBMIT SAFETY REPORT'}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
