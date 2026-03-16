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
import { Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';

export default function ResetPasswordScreen({ navigation }) {
  const { resetPassword } = useAuth();

  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleReset = async () => {
    if (!resetToken.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError('Token, new password and confirmation are required.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setSuccess('');
    setSubmitting(true);

    const result = await resetPassword(resetToken.trim(), newPassword);

    setSubmitting(false);

    if (!result.success) {
      setError(result.error || 'Unable to reset password.');
      return;
    }

    setSuccess(result.message || 'Password reset successful. You can now log in.');
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
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
          <Text className="text-slate-900 text-3xl font-black mb-2">Reset Password</Text>
          <Text className="text-slate-500 font-medium mb-8">Enter the reset token and your new password.</Text>

          <View className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm">
            <Text className="text-slate-700 text-xs font-bold uppercase tracking-widest mb-2">Reset Token</Text>
            <TextInput
              className="bg-slate-50 rounded-xl px-4 py-3 text-slate-900 mb-4 border border-slate-100"
              placeholder="Paste token"
              value={resetToken}
              onChangeText={setResetToken}
              autoCapitalize="none"
            />

            <Text className="text-slate-700 text-xs font-bold uppercase tracking-widest mb-2">New Password</Text>
            <View className="bg-slate-50 rounded-xl border border-slate-100 flex-row items-center px-4 mb-4">
              <TextInput
                className="flex-1 py-3 text-slate-900"
                placeholder="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNewPassword}
              />
              <TouchableOpacity onPress={() => setShowNewPassword((prev) => !prev)} className="pl-3 py-2">
                {showNewPassword ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
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
              />
              <TouchableOpacity onPress={() => setShowConfirmPassword((prev) => !prev)} className="pl-3 py-2">
                {showConfirmPassword ? <EyeOff size={18} color="#64748b" /> : <Eye size={18} color="#64748b" />}
              </TouchableOpacity>
            </View>

            {!!error && <Text className="text-red-500 text-sm mt-3">{error}</Text>}
            {!!success && <Text className="text-green-700 text-sm mt-3">{success}</Text>}

            <TouchableOpacity
              className={`mt-5 py-4 rounded-xl items-center ${submitting ? 'bg-blue-400' : 'bg-blue-600'}`}
              onPress={handleReset}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text className="text-white font-bold text-base">Reset Password</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity className="items-center mt-6" onPress={() => navigation.navigate('Login')}>
            <Text className="text-slate-600 font-medium">Back to Login</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
