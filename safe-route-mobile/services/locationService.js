import * as Location from 'expo-location';
import * as Linking from 'expo-linking';
import { GOOGLE_MAPS_API_KEY, MAPBOX_TOKEN, TOMTOM_API_KEY } from '../utils/config';

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
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return 'Current location';
  }

  const formatParts = (parts) => parts.filter(Boolean).map((part) => String(part).trim()).filter(Boolean).join(', ');

  if (TOMTOM_API_KEY) {
    try {
      const params = new URLSearchParams({
        key: TOMTOM_API_KEY,
        radius: '100',
      });
      const response = await fetch(
        `https://api.tomtom.com/search/2/reverseGeocode/${lat},${lon}.json?${params.toString()}`
      );
      const data = await response.json();
      const first = data?.addresses?.[0]?.address;

      const formatted = formatParts([
        first?.streetNumber && first?.streetName
          ? `${first.streetNumber} ${first.streetName}`
          : first?.streetName,
        first?.municipalitySubdivision,
        first?.municipality,
        first?.countrySubdivision,
      ]);
      if (formatted) return formatted;
    } catch (error) {
      console.warn('TomTom reverse geocode failed', error);
    }
  }

  if (GOOGLE_MAPS_API_KEY) {
    try {
      const params = new URLSearchParams({
        latlng: `${lat},${lon}`,
        key: GOOGLE_MAPS_API_KEY,
      });
      const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`);
      const data = await response.json();
      const first = data?.results?.[0];
      if (first?.formatted_address) {
        return first.formatted_address;
      }
    } catch (error) {
      console.warn('Google reverse geocode failed', error);
    }
  }

  if (MAPBOX_TOKEN) {
    try {
      const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        limit: '1',
      });
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json?${params.toString()}`
      );
      const data = await response.json();
      const feature = data?.features?.[0];
      if (feature?.place_name) {
        return feature.place_name;
      }
    } catch (error) {
      console.warn('Mapbox reverse geocode failed', error);
    }
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`,
      {
        headers: {
          'User-Agent': 'SafeRouteLiveMobile/1.0',
        },
      }
    );
    const data = await response.json();
    const address = data?.address;
    const formatted = formatParts([
      address?.road || address?.pedestrian || address?.path,
      address?.suburb || address?.neighbourhood,
      address?.city || address?.town || address?.village || address?.county,
      address?.state,
    ]);

    if (formatted) return formatted;
    if (data?.display_name) return data.display_name;
  } catch (error) {
    console.warn('Nominatim reverse geocode failed', error);
  }

  try {
    const data = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
    const first = data?.[0];
    if (!first) return 'Current location';

    const formatted = formatParts([
      first.name,
      first.street,
      first.district,
      first.city,
      first.subregion,
      first.region,
    ]);

    return formatted || 'Current location';
  } catch (error) {
    console.warn('Device reverse geocode failed', error);
    return 'Current location';
  }
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
