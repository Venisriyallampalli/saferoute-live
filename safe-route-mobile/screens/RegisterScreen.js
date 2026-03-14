import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      setError('Name, email, phone and password are required.');
      return;
    }

    if (phone.trim().length < 7) {
      setError('Please enter a valid phone number.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setSubmitting(true);

    const result = await register(name.trim(), email.trim(), password, phone.trim());

    setSubmitting(false);
    if (!result.success) {
      setError(result.error || 'Unable to register. Please try again.');
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
          contentContainerStyle={{ paddingVertical: 28, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text className="text-slate-900 text-3xl font-black mb-2">Create Account</Text>
          <Text className="text-slate-500 font-medium mb-8">Set up your SafeRoute profile</Text>

          <View className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
            <Text className="text-slate-700 text-xs font-bold uppercase tracking-widest mb-2">Name</Text>
            <TextInput
              className="bg-slate-50 rounded-xl px-4 py-3 text-slate-900 mb-4 border border-slate-100"
              placeholder="Your full name"
              value={name}
              onChangeText={setName}
            />

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

            <Text className="text-slate-700 text-xs font-bold uppercase tracking-widest mb-2">Phone</Text>
            <TextInput
              className="bg-slate-50 rounded-xl px-4 py-3 text-slate-900 mb-4 border border-slate-100"
              placeholder="Enter phone number"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              returnKeyType="next"
            />

            <Text className="text-slate-700 text-xs font-bold uppercase tracking-widest mb-2">Password</Text>
            <View className="bg-slate-50 rounded-xl border border-slate-100 flex-row items-center px-4 mb-4">
              <TextInput
                className="flex-1 py-3 text-slate-900"
                placeholder="Create password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="next"
              />
              <TouchableOpacity onPress={() => setShowPassword((prev) => !prev)} className="pl-3 py-2">
                {showPassword ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
              </TouchableOpacity>
            </View>

            <Text className="text-slate-700 text-xs font-bold uppercase tracking-widest mb-2">Confirm Password</Text>
            <View className="bg-slate-50 rounded-xl border border-slate-100 flex-row items-center px-4">
              <TextInput
                className="flex-1 py-3 text-slate-900"
                placeholder="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showConfirmPassword}
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword((prev) => !prev)} className="pl-3 py-2">
                {showConfirmPassword ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
              </TouchableOpacity>
            </View>

            {!!error && <Text className="text-red-500 text-sm mt-3">{error}</Text>}

            <TouchableOpacity
              className={`mt-5 py-4 rounded-xl items-center ${submitting ? 'bg-blue-400' : 'bg-blue-600'}`}
              onPress={handleRegister}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Create Account</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity className="items-center mt-6" onPress={() => navigation.navigate('Login')}>
            <Text className="text-slate-600 font-medium">
              Already have an account? <Text className="text-blue-600 font-bold">Login</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
