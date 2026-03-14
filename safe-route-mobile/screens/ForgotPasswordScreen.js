import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';

export default function ForgotPasswordScreen({ navigation }) {
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleRequestReset = async () => {
    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setError('');
    setMessage('');
    setSubmitting(true);

    const result = await forgotPassword(email.trim());

    setSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Unable to process request.');
      return;
    }

    const details = result.resetToken
      ? `${result.message}\n\nDev reset token:\n${result.resetToken}`
      : result.message;

    setMessage(details);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={20}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 28 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-slate-900 text-3xl font-black mb-2">Forgot Password</Text>
          <Text className="text-slate-500 font-medium mb-8">We will generate a reset token for your account.</Text>

          <View className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
            <Text className="text-slate-700 text-xs font-bold uppercase tracking-widest mb-2">Email</Text>
            <TextInput
              className="bg-slate-50 rounded-xl px-4 py-3 text-slate-900 border border-slate-100"
              placeholder="name@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            {!!error && <Text className="text-red-500 text-sm mt-3">{error}</Text>}
            {!!message && <Text className="text-green-700 text-sm mt-3">{message}</Text>}

            <TouchableOpacity
              className={`mt-5 py-4 rounded-xl items-center ${submitting ? 'bg-blue-400' : 'bg-blue-600'}`}
              onPress={handleRequestReset}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Generate Reset Token</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity className="items-center mt-6" onPress={() => navigation.navigate('ResetPassword')}>
            <Text className="text-blue-600 font-semibold">Already have a token? Reset password</Text>
          </TouchableOpacity>

          <TouchableOpacity className="items-center mt-4" onPress={() => navigation.navigate('Login')}>
            <Text className="text-slate-600 font-medium">Back to Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
