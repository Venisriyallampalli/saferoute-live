import React, { useEffect, useMemo, useState } from 'react';
import {
   View,
   Text,
   TouchableOpacity,
   TextInput,
   ActivityIndicator,
   Alert,
   Linking,
   Platform,
   Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, Users, ShieldCheck, Navigation } from 'lucide-react-native';
import * as DeviceContacts from 'expo-contacts';
import * as SMS from 'expo-sms';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import GlobalHeader from '../components/GlobalHeader';
import { useAuth } from '../context/AuthContext';
import { loadContacts } from '../services/contactsService';
import { requestLocationPermission, getCurrentLocation, reverseGeocodeCoords, buildLiveLocationLink } from '../services/locationService';
import { LIVE_SHARE_SMS_AUTO_KEY } from '../utils/storageKeys';

export default function ShareLiveScreen({ navigation }) {
  const { theme, colors } = useTheme();
   const { user } = useAuth();
   const userId = user?.id || user?._id || 'anonymous';

  const [searchQuery, setSearchQuery] = useState('');
   const [hasContactAccess, setHasContactAccess] = useState(null);
   const [contacts, setContacts] = useState([]);
   const [loading, setLoading] = useState(true);
   const [sharingContactId, setSharingContactId] = useState(null);
   const [autoSmsAllowed, setAutoSmsAllowed] = useState(false);

   const filteredContacts = useMemo(() => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return contacts;

      return contacts.filter((contact) => {
         const name = (contact.name || '').toLowerCase();
         const phone = (contact.phone || '').toLowerCase();
         const relation = (contact.relation || '').toLowerCase();
         return name.includes(query) || phone.includes(query) || relation.includes(query);
      });
   }, [contacts, searchQuery]);

   useEffect(() => {
      const fetchContacts = async () => {
         setLoading(true);
         try {
            const permission = await DeviceContacts.requestPermissionsAsync();
            const granted = permission.status === 'granted';
            setHasContactAccess(granted);

            if (!granted) {
               setContacts([]);
               return;
            }

            const items = await loadContacts(userId);
            setContacts(items);

            const consent = await AsyncStorage.getItem(LIVE_SHARE_SMS_AUTO_KEY);
            setAutoSmsAllowed(consent === 'true');
         } catch (error) {
            Alert.alert('Unable to load contacts', error.message || 'Try again in a moment.');
         } finally {
            setLoading(false);
         }
      };

      fetchContacts();
   }, [userId]);

   const requestContactsPermissionAgain = async () => {
      setLoading(true);
      try {
         const permission = await DeviceContacts.requestPermissionsAsync();
         const granted = permission.status === 'granted';
         setHasContactAccess(granted);

         if (!granted) {
            Alert.alert('Permission denied', 'Contacts access is needed to share live location to specific contacts.');
            setContacts([]);
            return;
         }

         const items = await loadContacts(userId);
         setContacts(items);
      } catch (error) {
         Alert.alert('Unable to update permission', error.message || 'Please try again.');
      } finally {
         setLoading(false);
      }
   };

   const getTrustedContacts = () => {
      const trusted = contacts.filter((contact) => {
         const relation = (contact.relation || '').toLowerCase();
         return relation.includes('trust') || relation.includes('family') || relation.includes('guardian');
      });
      return trusted.length ? trusted : contacts;
   };

   const ensureOneTimeAutoShareConsent = async () => {
      if (autoSmsAllowed) {
         return true;
      }

      return new Promise((resolve) => {
         Alert.alert(
            'Enable auto SMS share?',
            'Allow once to auto-open SMS sharing to your trusted contacts every time you tap Share Live.',
            [
               { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
               {
                  text: 'Allow once',
                  onPress: async () => {
                     await AsyncStorage.setItem(LIVE_SHARE_SMS_AUTO_KEY, 'true');
                     setAutoSmsAllowed(true);
                     resolve(true);
                  },
               },
            ]
         );
      });
   };

   const sendViaSmsOrShare = async (recipients, message) => {
      const phones = recipients.filter(Boolean);
      if (!phones.length) {
         throw new Error('No trusted contacts with phone numbers found.');
      }

      const smsAvailable = await SMS.isAvailableAsync();
      if (smsAvailable) {
         await SMS.sendSMSAsync(phones, message);
         return;
      }

      const joined = phones.join(',');
      const encoded = encodeURIComponent(message);
      const smsUrl = Platform.OS === 'ios' ? `sms:${joined}&body=${encoded}` : `sms:${joined}?body=${encoded}`;
      const canOpenSms = await Linking.canOpenURL(smsUrl);
      if (canOpenSms) {
         await Linking.openURL(smsUrl);
         return;
      }

      await Share.share({ message });
   };

   const ensureSharePermissions = async () => {
      const contactsPerm = await DeviceContacts.getPermissionsAsync();
      if (contactsPerm.status !== 'granted') {
         const requestedContacts = await DeviceContacts.requestPermissionsAsync();
         if (requestedContacts.status !== 'granted') {
            Alert.alert('Permission denied', 'Contacts access is required to continue live sharing.');
            return false;
         }
      }

      const locationGranted = await requestLocationPermission();
      if (!locationGranted) {
         Alert.alert('Permission denied', 'Location access is required to share your live location.');
         return false;
      }

      return true;
   };

   const shareToContactNow = async (contact) => {
      setSharingContactId(contact.id);
      try {
         const trustedContacts = getTrustedContacts();
         const recipients = trustedContacts.map((item) => item.phone).filter(Boolean);

         const location = await getCurrentLocation();
         const mapLink = buildLiveLocationLink(location.latitude, location.longitude);
         const place = await reverseGeocodeCoords(location.latitude, location.longitude).catch(() => 'Current location');

         const message = [`Hi, I am sharing my live location via SafeRoute.`, `Location: ${place}`, mapLink].join('\n');

         await sendViaSmsOrShare(recipients, message);
         Alert.alert('Shared', `Live location SMS prepared for ${recipients.length} trusted contact${recipients.length > 1 ? 's' : ''}.`);
      } catch (error) {
         Alert.alert('Share failed', error.message || 'Could not share live location right now.');
      } finally {
         setSharingContactId(null);
      }
   };

   const handleShareToContact = (contact) => {
      (async () => {
         try {
            const allowed = await ensureSharePermissions();
            if (!allowed) return;

            const consent = await ensureOneTimeAutoShareConsent();
            if (!consent) return;

            await shareToContactNow(contact);
         } catch (error) {
            Alert.alert('Share failed', error.message || 'Could not prepare live sharing permissions.');
         }
      })();
   };

  const renderEmptyState = () => (
    <View className="flex-1 items-center justify-center px-10 pt-20">
      <View style={{ backgroundColor: theme.primary + '15' }} className="w-24 h-24 rounded-[40px] items-center justify-center mb-8">
        <Users size={48} color={theme.primary} />
      </View>
         <Text style={{ color: colors.text }} className="text-2xl font-black mb-3">No emergency contacts yet</Text>
      <Text style={{ color: colors.textMuted }} className="text-center text-sm font-medium leading-6 mb-10">
            Add trusted contacts first, then share your live location directly to a selected person.
      </Text>
      <TouchableOpacity 
        style={{ backgroundColor: theme.primary }}
        className="px-10 py-5 rounded-[24px] shadow-2xl shadow-blue-300"
            onPress={() => navigation.navigate('Contacts')}
      >
            <Text className="text-white font-black uppercase tracking-widest text-sm">Open Contacts</Text>
      </TouchableOpacity>
    </View>
  );

   const renderContactCard = (contact) => {
      const sharing = sharingContactId === contact.id;

      return (
         <View key={contact.id} style={{ backgroundColor: colors.surface }} className="p-5 rounded-[28px] mb-4 border border-slate-100/10">
            <View className="flex-row items-center justify-between">
               <View className="flex-1 pr-4">
                  <Text style={{ color: colors.text }} className="font-bold text-base">{contact.name}</Text>
                  <Text style={{ color: colors.textMuted }} className="text-xs font-bold mt-1">{contact.phone}</Text>
                  <Text style={{ color: colors.textMuted }} className="text-xs mt-1">{contact.relation || 'Trusted'}</Text>
               </View>

               <TouchableOpacity
                  style={{ backgroundColor: sharing ? theme.primary + '90' : theme.primary }}
                  className="px-4 py-3 rounded-2xl flex-row items-center"
                  disabled={sharing}
                  onPress={() => handleShareToContact(contact)}
               >
                  {sharing ? <ActivityIndicator size="small" color="white" /> : <Navigation size={16} color="white" />}
                  <Text className="text-white font-black text-xs uppercase tracking-wider ml-2">Share Live</Text>
               </TouchableOpacity>
            </View>
         </View>
      );
   };

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
         <GlobalHeader navigation={navigation} />

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

      <View className="px-6 flex-1">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color={theme.primary} />
          </View>
            ) : hasContactAccess === false ? (
               <View className="flex-1 items-center justify-center px-6">
                  <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="rounded-2xl p-6 border items-center w-full">
                     <Users size={24} color={colors.textMuted} />
                     <Text style={{ color: colors.text }} className="font-bold mt-3">Contacts permission required</Text>
                     <Text style={{ color: colors.textMuted }} className="text-sm mt-1 text-center">
                        Please allow contacts access to share your live location with selected contacts.
                     </Text>
                     <TouchableOpacity
                        style={{ backgroundColor: theme.primary }}
                        className="mt-4 rounded-xl px-5 py-3"
                        onPress={requestContactsPermissionAgain}
                     >
                        <Text className="text-white font-bold">Allow Contacts Access</Text>
                     </TouchableOpacity>
                  </View>
               </View>
        ) : contacts.length === 0 ? (
          renderEmptyState()
        ) : filteredContacts.length === 0 ? (
          <View className="flex-1 items-center justify-center px-8">
            <Text style={{ color: colors.text }} className="text-lg font-black">No matching contacts</Text>
            <Text style={{ color: colors.textMuted }} className="text-sm text-center mt-2">Try a different name or phone number.</Text>
          </View>
        ) : (
          <View className="pb-6">
            {filteredContacts.map(renderContactCard)}
          </View>
        )}
      </View>

      {/* Footer Disclaimer */}
      <View className="p-10 items-center opacity-30">
          <ShieldCheck size={24} color={colors.textMuted} />
          <Text style={{ color: colors.textMuted }} className="text-[10px] font-bold uppercase tracking-[4px] mt-4">SafeRoute Social Layer</Text>
      </View>
    </SafeAreaView>
  );
}
