import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Eye, EyeOff, User, Mail, Phone, Lock, Shield, ArrowLeft } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth();
  const { theme, colors } = useTheme();

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
      setError('All fields are required for a safe start.');
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
    } else {
       navigation.replace('Home');
    }
  };

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView 
          className="flex-1 px-8" 
          contentContainerStyle={{ paddingVertical: 20, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} className="mb-6 w-10 h-10 items-center justify-center rounded-full bg-slate-100/10">
             <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>

          <View className="mb-10">
            <Text style={{ color: colors.text }} className="text-4xl font-black tracking-tighter">Create Your{"\n"}<Text style={{ color: theme.primary }}>Safety Profile</Text></Text>
            <Text style={{ color: colors.textMuted }} className="mt-2 font-bold uppercase tracking-widest text-[10px]">Join the SafeRoute Live circle</Text>
          </View>

          <View className="gap-y-5">
            <View>
              <Text style={{ color: colors.textMuted }} className="text-[10px] font-black uppercase tracking-widest ml-2 mb-2">Display Name</Text>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-row items-center border h-16 rounded-[24px] px-5">
                 <User size={18} color={colors.textMuted} />
                 <TextInput 
                   style={{ color: colors.text }}
                   className="flex-1 ml-4 font-bold text-sm"
                   placeholder="Your full name"
                   placeholderTextColor={colors.textMuted}
                   value={name}
                   onChangeText={setName}
                 />
              </View>
            </View>

            <View>
              <Text style={{ color: colors.textMuted }} className="text-[10px] font-black uppercase tracking-widest ml-2 mb-2">Email Access</Text>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-row items-center border h-16 rounded-[24px] px-5">
                 <Mail size={18} color={colors.textMuted} />
                 <TextInput 
                   style={{ color: colors.text }}
                   className="flex-1 ml-4 font-bold text-sm"
                   placeholder="name@example.com"
                   placeholderTextColor={colors.textMuted}
                   value={email}
                   onChangeText={setEmail}
                   keyboardType="email-address"
                   autoCapitalize="none"
                 />
              </View>
            </View>

            <View>
              <Text style={{ color: colors.textMuted }} className="text-[10px] font-black uppercase tracking-widest ml-2 mb-2">Rescue Contact (Phone)</Text>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-row items-center border h-16 rounded-[24px] px-5">
                 <Phone size={18} color={colors.textMuted} />
                 <TextInput 
                   style={{ color: colors.text }}
                   className="flex-1 ml-4 font-bold text-sm"
                   placeholder="Enter phone number"
                   placeholderTextColor={colors.textMuted}
                   value={phone}
                   onChangeText={setPhone}
                   keyboardType="phone-pad"
                 />
              </View>
            </View>

            <View>
              <Text style={{ color: colors.textMuted }} className="text-[10px] font-black uppercase tracking-widest ml-2 mb-2">The Security Key</Text>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-row items-center border h-16 rounded-[24px] px-5">
                 <Lock size={18} color={colors.textMuted} />
                 <TextInput 
                   style={{ color: colors.text }}
                   className="flex-1 ml-4 font-bold text-sm"
                   placeholder="Create strong password"
                   placeholderTextColor={colors.textMuted}
                   value={password}
                   onChangeText={setPassword}
                   secureTextEntry={!showPassword}
                 />
                 <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
                 </TouchableOpacity>
              </View>
            </View>

            <View>
              <Text style={{ color: colors.textMuted }} className="text-[10px] font-black uppercase tracking-widest ml-2 mb-2">Confirm Key</Text>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-row items-center border h-16 rounded-[24px] px-5">
                 <Lock size={18} color={colors.textMuted} />
                 <TextInput 
                   style={{ color: colors.text }}
                   className="flex-1 ml-4 font-bold text-sm"
                   placeholder="Repeat password"
                   placeholderTextColor={colors.textMuted}
                   value={confirmPassword}
                   onChangeText={setConfirmPassword}
                   secureTextEntry={!showConfirmPassword}
                 />
                 <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <EyeOff size={18} color={colors.textMuted} /> : <Eye size={18} color={colors.textMuted} />}
                 </TouchableOpacity>
              </View>
            </View>

            {!!error && <Text className="text-red-500 text-xs font-bold text-center">{error}</Text>}

            <TouchableOpacity 
              style={{ backgroundColor: theme.primary }}
              className="h-16 rounded-[24px] items-center justify-center shadow-2xl shadow-blue-300 mt-6"
              onPress={handleRegister}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-black uppercase tracking-widest">Create Account</Text>}
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-center mt-10">
             <Text style={{ color: colors.textMuted }} className="font-bold text-sm">Member already? </Text>
             <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={{ color: theme.primary }} className="font-black text-sm underline">Log In</Text>
             </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
