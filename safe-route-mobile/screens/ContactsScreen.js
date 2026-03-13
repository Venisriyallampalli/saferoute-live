import React from 'react';
import { View, Text, FlatList, TouchableOpacity, Image } from 'react-native';
import { User, Phone, MessageSquare, Share2, Plus } from 'lucide-react-native';

const mockContacts = [
  { id: '1', name: 'Alice Johnson', status: 'Active', phone: '+1 234 567 890', image: 'https://i.pravatar.cc/150?u=alice' },
  { id: '2', name: 'Robert Smith', status: 'Away', phone: '+1 987 654 321', image: 'https://i.pravatar.cc/150?u=bob' },
  { id: '3', name: 'Elena Gilbert', status: 'On Route', phone: '+1 555 123 456', image: 'https://i.pravatar.cc/150?u=elena' },
];

export default function ContactsScreen() {
  const renderItem = ({ item }) => (
    <TouchableOpacity className="bg-white rounded-3xl p-4 mb-4 flex-row items-center border border-slate-100 shadow-sm shadow-slate-200">
      <View className="w-16 h-16 rounded-2xl bg-blue-50 overflow-hidden mr-4">
        <Image source={{ uri: item.image }} className="w-full h-full" />
      </View>
      
      <View className="flex-1">
        <View className="flex-row items-center mb-1">
          <Text className="text-slate-900 font-bold text-lg mr-2">{item.name}</Text>
          <View className={`px-2 py-0.5 rounded-md ${item.status === 'Active' ? 'bg-green-100' : 'bg-slate-100'}`}>
            <Text className={`text-[10px] font-bold ${item.status === 'Active' ? 'text-green-600' : 'text-slate-500'}`}>
              {item.status.toUpperCase()}
            </Text>
          </View>
        </View>
        <Text className="text-slate-500 text-sm flex-row items-center">
          <Phone size={12} color="#94a3b8" /> {item.phone}
        </Text>
      </View>

      <View className="flex-row gap-x-2">
        <TouchableOpacity className="w-10 h-10 bg-blue-50 rounded-full items-center justify-center">
          <Share2 size={18} color="#3b82f6" />
        </TouchableOpacity>
        <TouchableOpacity className="w-10 h-10 bg-slate-50 rounded-full items-center justify-center">
          <MessageSquare size={18} color="#64748b" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View className="flex-1 bg-slate-50 px-6 pt-6">
      <View className="flex-row items-center justify-between mb-8">
        <View>
          <Text className="text-slate-900 text-3xl font-black">Contacts</Text>
          <Text className="text-slate-500 font-medium">Trusted safety inner circle</Text>
        </View>
        <TouchableOpacity className="bg-blue-600 w-12 h-12 rounded-2xl items-center justify-center shadow-lg shadow-blue-200">
          <Plus size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View className="bg-blue-50 p-4 rounded-2xl mb-6 border border-blue-100">
        <Text className="text-blue-800 text-sm font-semibold mb-1">Sharing Recommendation</Text>
        <Text className="text-blue-600/80 text-xs">Based on current night-time risk, we recommend sharing your route with Elena Gilbert.</Text>
      </View>

      <FlatList 
        data={mockContacts}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
}
