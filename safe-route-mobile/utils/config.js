import { Platform } from 'react-native';
import Constants from 'expo-constants';

const fallbackBaseUrl = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';

function getExpoHostIp() {
	const hostUri = Constants?.expoConfig?.hostUri || Constants?.manifest2?.extra?.expoClient?.hostUri || '';
	if (!hostUri) return null;

	const host = hostUri.split(':')[0];
	if (!host || host === 'localhost' || host === '127.0.0.1') return null;
	return host;
}

function resolveApiBaseUrl() {
	const envBase = (process.env.EXPO_PUBLIC_API_BASE_URL || '').trim();

	// Allow explicit override in .env while still supporting automatic LAN resolution.
	if (envBase && envBase.toLowerCase() !== 'auto') {
		return envBase;
	}

	const hostIp = getExpoHostIp();
	if (hostIp) {
		return `http://${hostIp}:3001`;
	}

	return fallbackBaseUrl;
}

export const API_BASE_URL = resolveApiBaseUrl();
export const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '';
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
export const WEATHER_API_KEY = process.env.EXPO_PUBLIC_WEATHER_API_KEY || '';
export const TOMTOM_API_KEY = process.env.EXPO_PUBLIC_TOMTOM_API_KEY || '';

export const hasMapboxToken = Boolean(MAPBOX_TOKEN);
export const hasGoogleMapsKey = Boolean(GOOGLE_MAPS_API_KEY);
export const hasWeatherApiKey = Boolean(WEATHER_API_KEY);
export const hasTomTomKey = Boolean(TOMTOM_API_KEY);
