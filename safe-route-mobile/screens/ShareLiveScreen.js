import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, FlatList, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Share2, Users, UserPlus, Clock, ShieldCheck, X, Navigation } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import GlobalHeader from '../components/GlobalHeader';

const { width } = Dimensions.get('window');

export default function ShareLiveScreen() {
  const { theme, colors } = useTheme();
  const [activeTab, setActiveTab] = useState('Friends');
  const [searchQuery, setSearchQuery] = useState('');

  const friends = []; // Empty state for testing

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center px-10 pt-20">
      <View style={{ backgroundColor: theme.primary + '15' }} className="w-24 h-24 rounded-[40px] items-center justify-center mb-8">
        <Users size={48} color={theme.primary} />
      </View>
      <Text style={{ color: colors.text }} className="text-2xl font-black mb-3">No friends yet</Text>
      <Text style={{ color: colors.textMuted }} className="text-center text-sm font-medium leading-6 mb-10">
        Start sharing your live location by adding friends to your trusted safety circle.
      </Text>
      <TouchableOpacity 
        style={{ backgroundColor: theme.primary }}
        className="px-10 py-5 rounded-[24px] shadow-2xl shadow-blue-300"
        onPress={() => setActiveTab('Search')}
      >
        <Text className="text-white font-black uppercase tracking-widest text-sm">Find Friends</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
      <GlobalHeader />

      <View className="px-6 py-6">
         <Text style={{ color: colors.text }} className="text-3xl font-black mb-6">Share Live</Text>

         {/* Search Bar */}
         <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-row items-center border h-16 rounded-[24px] px-5 shadow-sm">
            <Search size={20} color={colors.textMuted} />
            <TextInput 
              style={{ color: colors.text }}
              className="flex-1 ml-4 text-sm font-medium"
              placeholder="Search by name, email or phone..."
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
         </View>
      </View>

      {/* Tabs */}
      <View className="px-6 border-b border-slate-50/5 mb-6">
         <View className="flex-row items-center gap-x-8">
            {['Friends', 'Requests', 'Search'].map(tab => (
               <TouchableOpacity 
                 key={tab} 
                 className="pb-4 relative"
                 onPress={() => setActiveTab(tab)}
               >
                  <Text 
                    style={{ color: activeTab === tab ? theme.primary : colors.textMuted }} 
                    className={`text-sm font-black uppercase tracking-widest ${activeTab === tab ? '' : 'opacity-60'}`}
                  >
                    {tab}
                  </Text>
                  {activeTab === tab && (
                    <View style={{ backgroundColor: theme.primary }} className="absolute bottom-0 left-0 right-0 h-1.5 rounded-full" />
                  )}
               </TouchableOpacity>
            ))}
         </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
         {activeTab === 'Friends' && friends.length === 0 && renderEmptyState()}
         
         {activeTab === 'Search' && searchQuery.length > 0 && (
            <View className="px-6 pb-20">
               <Text style={{ color: colors.text }} className="text-lg font-black mb-6">Results for "{searchQuery}"</Text>
               {[1, 2, 3].map(i => (
                 <View key={i} style={{ backgroundColor: colors.surface }} className="p-5 rounded-[32px] mb-4 border border-slate-100/10 flex-row items-center justify-between">
                    <View className="flex-row items-center">
                       <View className="w-14 h-14 bg-slate-900 rounded-2xl items-center justify-center mr-4">
                          <Text className="text-white font-black text-xl">{String.fromCharCode(64 + i)}</Text>
                       </View>
                       <View>
                          <Text style={{ color: colors.text }} className="font-bold text-base">User {i}</Text>
                          <Text style={{ color: colors.textMuted }} className="text-xs font-bold">@user_handle_{i}</Text>
                       </View>
                    </View>
                    <TouchableOpacity style={{ backgroundColor: theme.primary }} className="w-10 h-10 rounded-full items-center justify-center shadow-md">
                       <UserPlus size={18} color="white" />
                    </TouchableOpacity>
                 </View>
               ))}
            </View>
         )}

         {/* Share Banner */}
         {activeTab === 'Friends' && friends.length > 0 && (
            <View className="px-6 mt-10">
               <View style={{ backgroundColor: theme.primary }} className="p-8 rounded-[40px] shadow-2xl shadow-blue-300">
                  <View className="flex-row items-center mb-4">
                     <Share2 size={24} color="white" />
                     <Text className="text-white text-xl font-bold ml-3">Invite Friends</Text>
                  </View>
                  <Text className="text-white/80 text-sm font-medium leading-6 mb-8">
                     Your safety circle is small. Invite more friends to keep everyone protected.
                  </Text>
                  <TouchableOpacity className="bg-white py-4 rounded-2xl items-center shadow-lg">
                     <Text style={{ color: theme.primary }} className="font-black uppercase tracking-widest text-xs">Share Referral Link</Text>
                  </TouchableOpacity>
               </View>
            </View>
         )}
      </ScrollView>

      {/* Footer Disclaimer */}
      <View className="p-10 items-center opacity-30">
          <ShieldCheck size={24} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted }} className="text-[10px] font-bold uppercase tracking-[4px] mt-4">SafeRoute Social Layer</Text>
      </View>
    </SafeAreaView>
  );
}
