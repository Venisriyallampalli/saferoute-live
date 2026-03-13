import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Send, MapPin, Loader2, User } from 'lucide-react-native';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { getChatMessages, sendChatMessage, markMessagesAsRead } from '../services/chatService';

export default function ChatScreen({ route }) {
  const { sessionId } = route.params || { sessionId: 'demo-session' };
  const { socket, isConnected } = useSocket();
  const { user } = useAuth();
  
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef(null);

  useEffect(() => {
    loadMessages();
  }, [sessionId]);

  useEffect(() => {
    if (!socket || !sessionId) return;

    const handleNewMessage = (message) => {
      if (message.sessionId === sessionId) {
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
          message: 'Welcome to the safety chat! How can we help you today?',
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
      setMessages(prev => [...prev, data.message]);
    } catch (error) {
      alert('Failed to send message');
      setNewMessage(text);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isOwn = item.sender._id === user?.id || item.sender === user?.id;
    return (
      <View className={`flex-row mb-4 ${isOwn ? 'justify-end' : 'justify-start'}`}>
        {!isOwn && (
          <View className="w-8 h-8 rounded-full bg-slate-200 items-center justify-center mr-2 self-end">
            <User size={16} color="#64748b" />
          </View>
        )}
        <View 
          className={`max-w-[75%] px-4 py-3 rounded-2xl ${
            isOwn ? 'bg-blue-600 rounded-tr-none' : 'bg-white border border-slate-100 rounded-tl-none shadow-sm'
          }`}
        >
          {!isOwn && (
            <Text className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
              {item.senderName || item.sender?.name || 'User'}
            </Text>
          )}
          <Text className={`text-sm ${isOwn ? 'text-white' : 'text-slate-800'}`}>
            {item.message}
          </Text>
          <Text className={`text-[9px] mt-1 ${isOwn ? 'text-blue-100' : 'text-slate-400'}`}>
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
          <TouchableOpacity className="w-10 h-10 bg-slate-50 rounded-full items-center justify-center">
            <MapPin size={20} color="#64748b" />
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
