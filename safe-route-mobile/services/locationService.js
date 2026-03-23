import * as Location from 'expo-location';
import * as Linking from 'expo-linking';

export async function requestLocationPermission() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation() {
  const granted = await requestLocationPermission();
  if (!granted) {
    throw new Error('Location permission denied');
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy,
    timestamp: location.timestamp,
  };
}

export async function reverseGeocodeCoords(latitude, longitude) {
  const data = await Location.reverseGeocodeAsync({ latitude, longitude });
  const first = data?.[0];
  if (!first) return 'Current location';

  return [first.name, first.street, first.city, first.region].filter(Boolean).join(', ');
}

export function buildLiveLocationLink(latitude, longitude) {
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}

export async function openMapAtLocation(latitude, longitude) {
  const url = buildLiveLocationLink(latitude, longitude);
  const supported = await Linking.canOpenURL(url);
  if (supported) {
    await Linking.openURL(url);
  }
}
