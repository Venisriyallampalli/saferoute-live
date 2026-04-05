import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { API_BASE_URL } from '../utils/config';
import { AUTH_TOKEN_KEY, LEGACY_TOKEN_KEY } from '../utils/storageKeys';

const AuthContext = createContext(null);
const TOKEN_STORAGE_KEY = AUTH_TOKEN_KEY;

function uniqueApiBases() {
  const hostUri = Constants?.expoConfig?.hostUri || '';
  const hostIp = hostUri.includes(':') ? hostUri.split(':')[0] : '';

  const candidates = [
    API_BASE_URL,
    hostIp ? `http://${hostIp}:3001` : null,
    'http://10.0.2.2:3001',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
  ];

  return [...new Set(candidates.filter(Boolean))];
}

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

  const fetchWithBaseFallback = async (path, options = {}) => {
    const bases = uniqueApiBases();
    let lastError = null;

    for (const base of bases) {
      try {
        const response = await fetch(`${base}${path}`, options);
        return response;
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error(`Unable to connect to backend. Tried: ${bases.join(', ')}`);
  };

  const fetchUser = async () => {
    try {
      const response = await fetchWithBaseFallback('/api/auth/me', {
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

  const login = async (email, password, options = {}) => {
    const expectedRole = options?.expectedRole || null;
    const loginPath = expectedRole === 'admin' ? '/api/auth/admin/login' : '/api/auth/login';

    try {
      const response = await fetchWithBaseFallback(loginPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok && data.token) {
        const resolvedRole = data?.user?.role || 'user';
        if (expectedRole && resolvedRole !== expectedRole) {
          return { success: false, error: `${expectedRole} account required` };
        }

        await AsyncStorage.setItem(TOKEN_STORAGE_KEY, data.token);
        setToken(data.token);
        setUser(data.user);
        return { success: true, user: data.user };
      } else {
        return { success: false, error: data.message || 'Login failed' };
      }
    } catch (error) {
      return { success: false, error: `Network error. Check backend URL in .env (current: ${API_BASE_URL})` };
    }
  };

  const loginAdmin = async (email, password) => login(email, password, { expectedRole: 'admin' });

  const register = async (name, email, password, phone) => {
    try {
      const response = await fetchWithBaseFallback('/api/auth/register', {
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
      return { success: false, error: `Network error. Check backend URL in .env (current: ${API_BASE_URL})` };
    }
  };

  const forgotPassword = async (email) => {
    try {
      const response = await fetchWithBaseFallback('/api/auth/forgot-password', {
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
      const response = await fetchWithBaseFallback('/api/auth/reset-password', {
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

  const loginWithGoogle = async (googleData) => {
     try {
       const response = await fetchWithBaseFallback('/api/auth/google', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(googleData)
       });
 
       const data = await response.json();
 
       if (response.ok && data.token) {
         await AsyncStorage.setItem(TOKEN_STORAGE_KEY, data.token);
         setToken(data.token);
         setUser(data.user);
         return { success: true };
       }
       return { success: false, error: data.message || 'Google login failed' };
     } catch (error) {
       return { success: false, error: 'Network error connecting to backend.' };
     }
  };

  const setGuestUser = () => {
    setUser({ 
      id: 'guest_' + Math.random().toString(36).substr(2, 9),
      name: 'Guest Explorer',
      email: 'guest@saferoute.live',
      phone: 'Not provided',
      isGuest: true 
    });
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
    loginAdmin,
    register,
    forgotPassword,
    resetPassword,
    loginWithGoogle,
    logout,
    setGuestUser,
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
