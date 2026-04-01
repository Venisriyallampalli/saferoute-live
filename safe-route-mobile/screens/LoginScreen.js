import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Shield, Eye, EyeOff, Navigation, Mail, Lock, Globe } from 'lucide-react-native';
// import { Image, Alert } from 'react-native';
// import * as WebBrowser from 'expo-web-browser';
// import * as Google from 'expo-auth-session/providers/google';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

// WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen({ navigation }) {
  const { login, setGuestUser } = useAuth();
  const { theme, colors } = useTheme();

  // const [request, response, promptAsync] = Google.useAuthRequest({
  //   androidClientId: '724794335326-e5gqlfsio3h98800eom3ce8hquknd5j0.apps.googleusercontent.com',
  //   iosClientId: '724794335326-5trdrs151089giav4elqdsqsn22r8h83.apps.googleusercontent.com',
  //   webClientId: '724794335326-r0jpmeca017uq9tifh8g1gtqt1ui25kj.apps.googleusercontent.com',
  //   useProxy: true, // Forces redirect through auth.expo.io
  // });

  // React.useEffect(() => {
  //   if (response?.type === 'success') {
  //     const { authentication } = response;
  //     handleGoogleToken(authentication.accessToken);
  //   }
  // }, [response]);

  // const handleGoogleToken = async (token) => {
  //   setSubmitting(true);
  //   try {
  //     const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
  //       headers: { Authorization: `Bearer ${token}` },
  //     });
  //     const googleUser = await res.json();

  //     const result = await loginWithGoogle({
  //       googleId: googleUser.sub,
  //       email: googleUser.email,
  //       name: googleUser.name,
  //       picture: googleUser.picture
  //     });

  //     if (!result.success) {
  //       setError(result.error);
  //     }
  //   } catch (err) {
  //     setError('Google Authentication failed.');
  //   } finally {
  //     setSubmitting(false);
  //   }
  // };

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

  const handleGuestAccess = () => {
    setGuestUser(); // Triggers reactive navigation in AppNavigator
  };

  return (
    <SafeAreaView style={{ backgroundColor: colors.background }} className="flex-1">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView
          className="flex-1 px-8"
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          showsVerticalScrollIndicator={false}
        >
          <View className="items-center mb-12">
            <View style={{ backgroundColor: theme.primary }} className="w-20 h-20 rounded-[32px] items-center justify-center mb-6 shadow-2xl shadow-blue-500">
              <Shield size={36} color="white" />
            </View>
            <Text style={{ color: colors.text }} className="text-4xl font-black tracking-tighter">SafeRoute <Text style={{ color: theme.primary }}>Live</Text></Text>
            <Text style={{ color: colors.textMuted }} className="mt-2 font-bold uppercase tracking-widest text-[10px]">Travel Smart. Travel Safe.</Text>
          </View>

          <View className="gap-y-5">
            <View>
              <Text style={{ color: colors.textMuted }} className="text-[10px] font-black uppercase tracking-widest ml-2 mb-2">Email Address</Text>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-row items-center border h-16 rounded-[24px] px-5">
                <Mail size={18} color={colors.textMuted} />
                <TextInput
                  style={{ color: colors.text }}
                  className="flex-1 ml-4 font-bold text-sm"
                  placeholder="name@example.com"
                  placeholderTextColor={colors.textMuted}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                />
              </View>
            </View>

            <View>
              <Text style={{ color: colors.textMuted }} className="text-[10px] font-black uppercase tracking-widest ml-2 mb-2">Security Key</Text>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.border }} className="flex-row items-center border h-16 rounded-[24px] px-5">
                <Lock size={18} color={colors.textMuted} />
                <TextInput
                  style={{ color: colors.text }}
                  className="flex-1 ml-4 font-bold text-sm"
                  placeholder="Enter password"
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

            {!!error && <Text className="text-red-500 text-xs font-bold text-center">{error}</Text>}

            <TouchableOpacity
              style={{ backgroundColor: theme.primary }}
              className="h-16 rounded-[24px] items-center justify-center shadow-2xl shadow-blue-300 mt-4"
              onPress={handleLogin}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator color="white" /> : <Text className="text-white font-black uppercase tracking-widest">Sign In</Text>}
            </TouchableOpacity>

            {/*
            <View className="flex-row items-center my-6 text-slate-400">
              <View className="flex-1 h-[1px] bg-slate-100" />
              <Text className="mx-4 text-[10px] font-black uppercase tracking-widest opacity-20">or connect with</Text>
              <View className="flex-1 h-[1px] bg-slate-100" />
            </View>

            <TouchableOpacity
              disabled={!request || submitting}
              style={{ backgroundColor: colors.surface, borderColor: colors.border }}
              className="h-16 rounded-[24px] items-center justify-center flex-row border"
              onPress={() => promptAsync()}
            >
              <Image
                source={{ uri: 'https://cdn-icons-png.flaticon.com/512/2991/2991148.png' }}
                className="w-6 h-6 mr-3"
              />
              <Text style={{ color: colors.text }} className="font-bold text-sm">Continue with Google</Text>
            </TouchableOpacity>
            */}

            <TouchableOpacity className="items-center py-4" onPress={handleGuestAccess}>
              <Text style={{ color: theme.primary }} className="font-black uppercase tracking-widest text-[11px]">Continue without account</Text>
            </TouchableOpacity>
          </View>

          <View className="flex-row justify-center mt-10">
            <Text style={{ color: colors.textMuted }} className="font-bold text-sm">New to SafeRoute? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={{ color: theme.primary }} className="font-black text-sm underline">Create Account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
