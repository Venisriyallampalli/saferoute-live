import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuth } from '../context/AuthContext';

import HomeScreen from '../screens/HomeScreen';
import MapScreen from '../screens/MapScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ChatScreen from '../screens/ChatScreen';
import SafetyReportScreen from '../screens/SafetyReportScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text className="mt-3 text-slate-500 font-medium">Checking session...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <Stack.Navigator initialRouteName="Login">
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create Account' }} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Forgot Password' }} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Reset Password' }} />
      </Stack.Navigator>
    );
  }

  return (
    <Stack.Navigator initialRouteName="Home">
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Map" component={MapScreen} options={{ title: 'Live Navigation' }} />
      <Stack.Screen name="Contacts" component={ContactsScreen} options={{ title: 'Emergency Contacts' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Safety Chat' }} />
      <Stack.Screen name="HazardReport" component={SafetyReportScreen} options={{ title: 'Report Hazard' }} />
      <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
    </Stack.Navigator>
  );
}
