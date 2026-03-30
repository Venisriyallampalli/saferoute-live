import { Platform } from 'react-native';

const fallbackBaseUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || fallbackBaseUrl;
export const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
export const WEATHER_API_KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY || '';
export const TOMTOM_API_KEY = process.env.EXPO_PUBLIC_TOMTOM_API_KEY || '';

export const hasMapboxToken = Boolean(MAPBOX_TOKEN);
export const hasGoogleMapsKey = Boolean(GOOGLE_MAPS_API_KEY);
export const hasWeatherApiKey = Boolean(WEATHER_API_KEY);
export const hasTomTomKey = Boolean(TOMTOM_API_KEY);
