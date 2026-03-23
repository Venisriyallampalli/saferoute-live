import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Text } from 'react-native';
import { useAuth } from '../context/AuthContext';

import HomeScreen from '../screens/HomeScreen';
import MapScreen from '../screens/MapScreen';
import ContactsScreen from '../screens/ContactsScreen';
import SafetyChatScreen from '../screens/SafetyChatScreen';
import SafetyReportScreen from '../screens/SafetyReportScreen';
import SettingsScreen from '../screens/SettingsScreen';
import RoutePlannerScreen from '../screens/RoutePlannerScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ShareLiveScreen from '../screens/ShareLiveScreen';
import SosScreen from '../screens/SosScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import ProfileScreen from '../screens/ProfileScreen';

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

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        // Auth Stack
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: true, title: 'Create Account' }} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: true, title: 'Forgot Password' }} />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ headerShown: true, title: 'Reset Password' }} />
        </>
      ) : (
        // App Stack
        <>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Map" component={MapScreen} />
          <Stack.Screen name="RouteSelection" component={RoutePlannerScreen} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} />
          <Stack.Screen name="ShareLive" component={ShareLiveScreen} />
          <Stack.Screen name="Sos" component={SosScreen} />
          
          <Stack.Screen name="Contacts" component={ContactsScreen} options={{ headerShown: true, title: 'Emergency Contacts' }} />
          <Stack.Screen name="SafetyChat" component={SafetyChatScreen} options={{ headerShown: true, title: 'Safety Chat' }} />
          <Stack.Screen name="HazardReport" component={SafetyReportScreen} options={{ headerShown: true, title: 'Report Hazard' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: true, title: 'Settings' }} />
          <Stack.Screen name="Profile" component={ProfileScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}
