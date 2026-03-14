import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const AuthContext = createContext(null);
const TOKEN_STORAGE_KEY = 'saferoute_auth_token';
const LEGACY_TOKEN_KEY = 'token';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001');

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(null);

  // Load token on mount
  useEffect(() => {
    const loadToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
        if (storedToken) {
          setToken(storedToken);
        } else {
          // Cleanup old generic key to avoid accidental auto-login from legacy builds.
          await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
          setLoading(false);
        }
      } catch (e) {
        setLoading(false);
      }
    };
    loadToken();
  }, []);

  // Fetch user details when token changes
  useEffect(() => {
    if (token) {
      fetchUser();
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        await AsyncStorage.multiRemove([TOKEN_STORAGE_KEY, LEGACY_TOKEN_KEY]);
        setToken(null);
        setUser(null);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      await AsyncStorage.multiRemove([TOKEN_STORAGE_KEY, LEGACY_TOKEN_KEY]);
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.token) {
        await AsyncStorage.setItem(TOKEN_STORAGE_KEY, data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.message || 'Login failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const register = async (name, email, password, phone) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, phone })
      });

      const data = await response.json();

      if (response.ok && data.token) {
        await AsyncStorage.setItem(TOKEN_STORAGE_KEY, data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.message || 'Registration failed' };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const forgotPassword = async (email) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { success: false, error: data.message || 'Failed to start password reset' };
      }

      return {
        success: true,
        message: data.message || 'Password reset started',
        resetToken: data.resetToken || null,
      };
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const resetPassword = async (resetToken, newPassword) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        return { success: false, error: data.message || 'Failed to reset password' };
      }

      return { success: true, message: data.message || 'Password reset successfully' };
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const loginWithGoogle = () => {
    // In React Native, window.location.href won't work.
    // For a real mobile implementation, use expo-auth-session or equivalent Google Sign In package. 
    console.warn("Google Sign in requires a React Native OAuth provider setup.");
  };

  const logout = async () => {
    await AsyncStorage.multiRemove([TOKEN_STORAGE_KEY, LEGACY_TOKEN_KEY]);
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    apiBaseUrl: API_BASE_URL,
    loading,
    login,
    register,
    forgotPassword,
    resetPassword,
    loginWithGoogle,
    logout,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
