import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Send, MapPin, User, Shield } from 'lucide-react-native';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { getChatMessages, sendChatMessage, markMessagesAsRead } from '../services/chatService';
import { getCurrentLocation } from '../services/locationService';

const buildLiveLocationLink = (lat, lng) => 
  `https://www.google.com/maps?q=${lat},${lng}`;

export default function ChatScreen({ route }) {
  const { sessionId } = route.params || { sessionId: 'demo-session' };
  const { socket } = useSocket();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharingLocation, setSharingLocation] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    loadMessages();
  }, [sessionId]);

  useEffect(() => {
    if (!socket || !sessionId) return;

    const handleNewMessage = (message) => {
      if (message.sessionId === sessionId || sessionId === 'demo-session') {
        setMessages(prev => {
          if (prev.find(m => m._id === message._id)) return prev;
          return [...prev, message];
        });
        
        if (message.sender._id !== user?.id) {
          markMessagesAsRead(sessionId).catch(console.error);
        }
      }
    };

    socket.on('chat:newMessage', handleNewMessage);
    return () => socket.off('chat:newMessage', handleNewMessage);
  }, [socket, sessionId, user]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const data = await getChatMessages(sessionId);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Error loading messages:', error);
      // For demo purposes, add a mock message if API fails
      if (sessionId === 'demo-session') {
        setMessages([{
          _id: '1',
          message: 'Welcome to Safety Chat. Send updates to trusted contacts and share your live location if needed.',
          sender: { _id: 'admin', name: 'SafeRoute Bot' },
          createdAt: new Date().toISOString()
        }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;

    const text = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      const data = await sendChatMessage(sessionId, text);
      const userMsg = data.message || {
          _id: String(Date.now()),
          message: text,
          senderName: 'You',
          createdAt: new Date().toISOString()
      };

      setMessages(prev => {
        if (prev.find((item) => item._id === userMsg._id)) return prev;
        return [...prev, userMsg];
      });

      // AI Logic for Safety Monitoring
      if (sessionId === 'demo-session') {
          setTimeout(() => {
              let aiResponse = "I'm monitoring your route safety. Stay in well-lit areas.";
              const lower = text.toLowerCase();
              if (lower.includes('help') || lower.includes('danger')) {
                  aiResponse = "I have detected a high-priority alert. Should I trigger SOS for you?";
              } else if (lower.includes('where') || lower.includes('location')) {
                  aiResponse = "You are currently on the safest calculated path. Your live location is active.";
              } else if (lower.includes('contacts') || lower.includes('friend')) {
                  aiResponse = "Your trusted contacts have been notified of your current trip status.";
              }

              const aiMsg = {
                  _id: `ai-${Date.now()}`,
                  message: aiResponse,
                  sender: { _id: 'ai-assistant', name: 'SafeRoute AI' },
                  senderName: 'SafeRoute AI',
                  createdAt: new Date().toISOString()
              };
              setMessages(prev => [...prev, aiMsg]);
          }, 1000);
      }
    } catch (error) {
      alert('Failed to send message');
      setNewMessage(text);
    } finally {
      setSending(false);
    }
  };

  const handleShareLocation = async () => {
    if (sharingLocation) return;

    setSharingLocation(true);
    try {
      const location = await getCurrentLocation();
      const link = buildLiveLocationLink(location.latitude, location.longitude);
      const message = `Live location: ${link}`;
      const data = await sendChatMessage(sessionId, message, 'location', {
        latitude: location.latitude,
        longitude: location.longitude,
      });

      setMessages((prev) => {
        if (prev.find((item) => item._id === data.message?._id)) return prev;
        return [...prev, data.message];
      });
    } catch (error) {
      Alert.alert('Location share failed', error.message || 'Unable to share location.');
    } finally {
      setSharingLocation(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isOwn = item.sender._id === user?.id || item.sender === user?.id || item.senderName === 'You';
    const isAi = item.senderName === 'SafeRoute AI' || item.sender?._id === 'ai-assistant';

    return (
      <View className={`flex-row mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
        {!isOwn && (
          <View className={`w-8 h-8 rounded-full ${isAi ? 'bg-pink-100' : 'bg-slate-200'} items-center justify-center mr-2 self-end shadow-sm`}>
            {isAi ? <Shield size={16} color="#db2777" /> : <User size={16} color="#64748b" />}
          </View>
        )}
        <View 
          className={`max-w-[75%] px-4 py-3 rounded-2xl ${
            isOwn ? 'bg-blue-600 rounded-tr-none shadow-blue-200' : 
            isAi ? 'bg-pink-50 border border-pink-100 rounded-tl-none shadow-pink-100' : 'bg-white border border-slate-100 rounded-tl-none shadow-sm'
          } shadow-md`}
        >
          {(!isOwn || isAi) && (
            <View className="flex-row items-center mb-1">
               <Text className={`text-[10px] font-black uppercase tracking-wider ${isAi ? 'text-pink-600' : 'text-slate-400'}`}>
                 {item.senderName || item.sender?.name || 'User'}
               </Text>
               {isAi && (
                 <View className="bg-pink-600 px-1 rounded ml-1.5 align-middle">
                    <Text className="text-[7px] text-white font-black italic">AI</Text>
                 </View>
               )}
            </View>
          )}
          <Text className={`text-sm leading-5 ${isOwn ? 'text-white font-medium' : 'text-slate-800'}`}>
            {item.message}
          </Text>
          <Text className={`text-[9px] mt-1.5 opacity-60 ${isOwn ? 'text-blue-100' : 'text-slate-400'}`}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-slate-50"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View className="flex-1 px-4">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="small" color="#3b82f6" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            renderItem={renderMessage}
            keyExtractor={item => item._id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 20 }}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}
      </View>

      <View className="p-4 bg-white border-t border-slate-100">
        <View className="flex-row items-center space-x-2">
          <TouchableOpacity
            className={`w-10 h-10 rounded-full items-center justify-center ${sharingLocation ? 'bg-blue-100' : 'bg-slate-50'}`}
            onPress={handleShareLocation}
          >
            {sharingLocation ? <ActivityIndicator size="small" color="#2563eb" /> : <MapPin size={20} color="#64748b" />}
          </TouchableOpacity>
          <View className="flex-1 bg-slate-50 rounded-2xl px-4 py-2 flex-row items-center border border-slate-100">
            <TextInput
              className="flex-1 text-slate-800 text-sm h-10"
              placeholder="Type a message..."
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
            />
          </View>
          <TouchableOpacity 
            className={`w-12 h-12 rounded-full items-center justify-center shadow-md ${
              newMessage.trim() ? 'bg-blue-600 shadow-blue-200' : 'bg-slate-200 shadow-none'
            }`}
            onPress={handleSend}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Send size={20} color="white" />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
