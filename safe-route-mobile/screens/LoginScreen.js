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
import { Shield, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    setError('');
    setSubmitting(true);

    const result = await login(email.trim(), password);

    setSubmitting(false);
    if (!result.success) {
      setError(result.error || 'Unable to login. Please try again.');
    }
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
          <View className="items-center mb-10">
            <View className="w-16 h-16 rounded-2xl bg-blue-600 items-center justify-center mb-4">
              <Shield size={32} color="white" />
            </View>
            <Text className="text-slate-900 text-3xl font-black">SafeRoute Live</Text>
            <Text className="text-slate-500 mt-2 font-medium">Sign in to continue safely</Text>
          </View>

          <View className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
            <Text className="text-slate-700 text-xs font-bold uppercase tracking-widest mb-2">Email</Text>
            <TextInput
              className="bg-slate-50 rounded-xl px-4 py-3 text-slate-900 mb-4 border border-slate-100"
              placeholder="name@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />

            <Text className="text-slate-700 text-xs font-bold uppercase tracking-widest mb-2">Password</Text>
            <View className="bg-slate-50 rounded-xl border border-slate-100 flex-row items-center px-4">
              <TextInput
                className="flex-1 py-3 text-slate-900"
                placeholder="Enter password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)} className="pl-3 py-2">
                {showPassword ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
              </TouchableOpacity>
            </View>

            {!!error && <Text className="text-red-500 text-sm mt-3">{error}</Text>}

            <TouchableOpacity className="items-end mt-3" onPress={() => navigation.navigate('ForgotPassword')}>
              <Text className="text-blue-600 font-semibold text-sm">Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`mt-5 py-4 rounded-xl items-center ${submitting ? 'bg-blue-400' : 'bg-blue-600'}`}
              onPress={handleLogin}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Login</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity className="items-center mt-6" onPress={() => navigation.navigate('Register')}>
            <Text className="text-slate-600 font-medium">
              New here? <Text className="text-blue-600 font-bold">Create account</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
