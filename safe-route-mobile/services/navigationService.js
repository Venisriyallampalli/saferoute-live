import { MAPBOX_TOKEN, GOOGLE_MAPS_API_KEY, TOMTOM_API_KEY } from '../utils/config';

export const TRANSPORT_MODES = {
  HEAVY: 'heavy',
  CAR: 'car',
  BIKE: 'bike',
  CYCLE: 'cycle',
  WALK: 'walk',
};

function normalizeTransportMode(mode) {
  const normalized = String(mode || '').toLowerCase();
  if (Object.values(TRANSPORT_MODES).includes(normalized)) {
    return normalized;
  }
  return TRANSPORT_MODES.CAR;
}

function mapTomTomTravelMode(mode) {
  if (mode === TRANSPORT_MODES.HEAVY) return 'truck';
  if (mode === TRANSPORT_MODES.BIKE) return 'motorcycle';
  if (mode === TRANSPORT_MODES.CYCLE) return 'bicycle';
  if (mode === TRANSPORT_MODES.WALK) return 'pedestrian';
  return 'car';
}

function mapGoogleMode(mode) {
  if (mode === TRANSPORT_MODES.CYCLE) return 'bicycling';
  if (mode === TRANSPORT_MODES.WALK) return 'walking';
  return 'driving';
}

function mapMapboxProfile(mode) {
  if (mode === TRANSPORT_MODES.CYCLE) return 'cycling';
  if (mode === TRANSPORT_MODES.WALK) return 'walking';
  return 'driving';
}

function mapOsrmProfile(mode) {
  if (mode === TRANSPORT_MODES.CYCLE) return 'cycling';
  if (mode === TRANSPORT_MODES.WALK) return 'walking';
  return 'driving';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeTrafficDensityFromSummary(summary = {}) {
  const travel = Number(summary.travelTimeInSeconds || 0);
  const delay = Number(summary.trafficDelayInSeconds || 0);
  if (travel <= 0) return 0.5;

  return clamp((delay / travel) * 1.5, 0, 1);
}

function decodePolyline(encoded) {
  let index = 0;
  const length = encoded.length;
  let latitude = 0;
  let longitude = 0;
  const coordinates = [];

  while (index < length) {
    let result = 1;
    let shift = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63 - 1;
      result += byte << shift;
      shift += 5;
    } while (byte >= 0x1f);

    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    result = 1;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63 - 1;
      result += byte << shift;
      shift += 5;
    } while (byte >= 0x1f);

    longitude += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push({ latitude: latitude * 1e-5, longitude: longitude * 1e-5 });
  }

  return coordinates;
}

export async function geocodeDestination(query) {
  const cleaned = query.trim();
  if (!cleaned) return null;

  if (TOMTOM_API_KEY) {
    try {
      const params = new URLSearchParams({
        key: TOMTOM_API_KEY,
        limit: '1',
      });

      const response = await fetch(
        `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(cleaned)}.json?${params.toString()}`
      );
      const data = await response.json();

      if (Array.isArray(data.results) && data.results.length) {
        const first = data.results[0];
        return {
          latitude: Number(first.position?.lat),
          longitude: Number(first.position?.lon),
          placeName: first.address?.freeformAddress || cleaned,
        };
      }
    } catch (error) {
      console.warn('TomTom geocoding failed', error);
    }
  }

  if (GOOGLE_MAPS_API_KEY) {
    const params = new URLSearchParams({ address: cleaned, key: GOOGLE_MAPS_API_KEY });
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await response.json();

    if (data.status === 'OK' && data.results?.length) {
      const location = data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
        placeName: data.results[0].formatted_address,
      };
    }
  }

  if (MAPBOX_TOKEN) {
    const params = new URLSearchParams({
      access_token: MAPBOX_TOKEN,
      limit: '1',
      types: 'address,place,locality,poi',
    });

    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cleaned)}.json?${params}`
    );
    const data = await response.json();

    if (data.features?.length) {
      const feature = data.features[0];
      return {
        longitude: feature.center[0],
        latitude: feature.center[1],
        placeName: feature.place_name,
      };
    }
  }

  // 3. Nominatim (OpenStreetMap) - Free Fallback
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleaned)}&limit=1`,
      {
        headers: {
          'User-Agent': 'SafeRouteLiveMobile/1.0',
        },
      }
    );
    const data = await response.json();
    if (data?.length) {
      const first = data[0];
      return {
        latitude: parseFloat(first.lat),
        longitude: parseFloat(first.lon),
        placeName: first.display_name,
      };
    }
  } catch (error) {
    console.warn('Nominatim geocoding failed', error);
  }

  return null;
}

export async function fetchRoute(origin, destination, transportMode = TRANSPORT_MODES.CAR) {
  const selectedMode = normalizeTransportMode(transportMode);

  if (TOMTOM_API_KEY) {
    try {
      const endpoint = `https://api.tomtom.com/routing/1/calculateRoute/${origin.latitude},${origin.longitude}:${destination.latitude},${destination.longitude}/json`;
      const params = new URLSearchParams({
        key: TOMTOM_API_KEY,
        traffic: 'true',
        routeType: 'fastest',
        travelMode: mapTomTomTravelMode(selectedMode),
        maxAlternatives: '2',
        instructionsType: 'text',
        language: 'en-US',
        computeTravelTimeFor: 'all',
      });

      const response = await fetch(`${endpoint}?${params.toString()}`);
      const data = await response.json();

      if (Array.isArray(data.routes) && data.routes.length) {
        return data.routes.map((r, i) => {
          const summary = r.summary || {};
          const leg = Array.isArray(r.legs) ? r.legs[0] : null;
          const points = (leg?.points || []).map((point) => ({
            latitude: Number(point.latitude),
            longitude: Number(point.longitude),
          }));

          const instructions = Array.isArray(r.guidance?.instructions)
            ? r.guidance.instructions
            : [];

          return {
            id: `route-${i}`,
            distanceMeters: Number(summary.lengthInMeters || 0),
            durationSeconds: Number(summary.travelTimeInSeconds || 0),
            trafficDelaySeconds: Number(summary.trafficDelayInSeconds || 0),
            trafficDensity: normalizeTrafficDensityFromSummary(summary),
            transportMode: selectedMode,
            coordinates: points,
            summary: summary.route || `Route ${i + 1}`,
            isAlternative: i > 0,
            steps: instructions.map((instruction) => ({
              maneuver: { instruction: instruction.message || instruction.instruction || 'Continue' },
              distance: Number(instruction.routeOffsetInMeters || 0),
              duration: Number(instruction.travelTimeInSeconds || 0),
            })),
          };
        });
      }
    } catch (error) {
      console.warn('TomTom routing failed, falling back to other providers', error);
    }
  }

  // 1. Try Google Directions API first if key exists
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const params = new URLSearchParams({
        origin: `${origin.latitude},${origin.longitude}`,
        destination: `${destination.latitude},${destination.longitude}`,
        mode: mapGoogleMode(selectedMode),
        alternatives: 'true',
        key: GOOGLE_MAPS_API_KEY
      });
      const response = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`);
      const data = await response.json();

      if (data.status === 'OK' && data.routes?.length) {
        return data.routes.map((r, i) => {
          const leg = r.legs[0];
          return {
            id: `route-${i}`,
            distanceMeters: leg.distance.value,
            durationSeconds: leg.duration.value,
            trafficDensity: null,
            transportMode: selectedMode,
            coordinates: decodePolyline(r.overview_polyline.points),
            summary: r.summary || `Route ${i + 1}`,
            isAlternative: i > 0,
            steps: leg.steps.map(s => ({
              maneuver: { instruction: s.html_instructions.replace(/<[^>]*>?/gm, '') },
              distance: s.distance.value,
              duration: s.duration.value,
            }))
          };
        });
      }
    } catch (error) {
      console.warn('Google Directions API failed', error);
    }
  }

  // 2. Try Mapbox if token exists
  if (MAPBOX_TOKEN) {
    try {
      const profile = mapMapboxProfile(selectedMode);
      const endpoint = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;

      const params = new URLSearchParams({
        access_token: MAPBOX_TOKEN,
        alternatives: 'true', // Request alternatives
        geometries: 'polyline',
        overview: 'full',
        steps: 'true'
      });

      const response = await fetch(`${endpoint}?${params}`);
      const data = await response.json();

      if (data.routes?.length) {
        return data.routes.map((r, i) => ({
          id: `route-${i}`,
          distanceMeters: r.distance,
          durationSeconds: r.duration,
          trafficDensity: null,
          transportMode: selectedMode,
          coordinates: decodePolyline(r.geometry),
          summary: r.legs[0]?.summary || `Route ${i + 1}`,
          isAlternative: i > 0,
          steps: r.legs[0]?.steps || []
        }));
      }
    } catch (error) {
      console.warn('Mapbox routing failed, falling back to OSRM', error);
    }
  }

  // 2. OSRM (Open Source Routing Machine) - Free Fallback
  try {
    const profile = mapOsrmProfile(selectedMode);
    const endpoint = `https://router.project-osrm.org/route/v1/${profile}/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=polyline&alternatives=true&steps=true`;
    const response = await fetch(endpoint);
    const data = await response.json();

    if (data.code === 'Ok' && data.routes?.length) {
      return data.routes.map((r, i) => ({
        id: `route-${i}`,
        distanceMeters: r.distance,
        durationSeconds: r.duration,
        trafficDensity: null,
        transportMode: selectedMode,
        coordinates: decodePolyline(r.geometry),
        summary: `Route ${i + 1}`,
        isAlternative: i > 0,
        steps: r.legs[0]?.steps || []
      }));
    }
  } catch (error) {
    throw new Error('Routing service unavailable. Please check your internet connection.');
  }

  throw new Error('No route found for that destination.');
}

export function getMockSafetyMarkers(origin) {
  if (!origin) return { hospitals: [], policeStations: [], hazards: [] };

  return {
    hospitals: [
      {
        id: 'hospital-1',
        latitude: origin.latitude + 0.004,
        longitude: origin.longitude - 0.003,
        name: 'City General Hospital',
      },
      {
        id: 'hospital-2',
        latitude: origin.latitude - 0.006,
        longitude: origin.longitude + 0.005,
        name: 'Community Health Center',
      },
    ],
    policeStations: [
      {
        id: 'police-1',
        latitude: origin.latitude + 0.003,
        longitude: origin.longitude + 0.004,
        name: 'Central Police Post',
      },
    ],
    hazards: [
      {
        id: 'hazard-1',
        latitude: origin.latitude - 0.002,
        longitude: origin.longitude - 0.002,
        type: 'Poor Lighting',
      },
      {
        id: 'hazard-2',
        latitude: origin.latitude + 0.007,
        longitude: origin.longitude + 0.002,
        type: 'Crowded Junction',
      },
    ],
  };
}

export async function fetchPlaceSuggestions(query, userLocation = null) {
  const cleaned = query.trim();
  if (!cleaned || cleaned.length < 3) return [];

  const allResults = [];

  // 0. TomTom Search suggestions
  if (TOMTOM_API_KEY) {
    try {
      const params = {
        key: TOMTOM_API_KEY,
        limit: '8',
      };

      if (userLocation) {
        params.lat = String(userLocation.latitude);
        params.lon = String(userLocation.longitude);
      }

      const queryParams = new URLSearchParams(params);
      const response = await fetch(
        `https://api.tomtom.com/search/2/search/${encodeURIComponent(cleaned)}.json?${queryParams.toString()}`
      );
      const data = await response.json();

      if (Array.isArray(data.results)) {
        data.results.forEach((item, idx) => {
          const main = item?.address?.freeformAddress || item?.poi?.name || cleaned;
          const id = item.id || `tomtom-${idx}-${main}`;
          if (allResults.some((existing) => existing.id === id)) {
            return;
          }

          allResults.push({
            id,
            description: main,
            placeName: main,
            latitude: Number(item?.position?.lat),
            longitude: Number(item?.position?.lon),
            mainText: item?.poi?.name || main,
            secondaryText: item?.address?.municipality || item?.address?.countrySubdivision || '',
            source: 'tomtom',
          });
        });
      }
    } catch (error) {
      console.warn('TomTom suggestions error', error);
    }
  }

  // 1. Fetch Google Places Autocomplete
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const params = {
        input: cleaned,
        key: GOOGLE_MAPS_API_KEY,
        // OMIT TYPES to get everything (POI, establishment, etc.)
      };

      // Add location BIAS but NO RADIUS (to ensure nothing is hidden)
      if (userLocation) {
        params.location = `${userLocation.latitude},${userLocation.longitude}`;
      }

      const queryParams = new URLSearchParams(params);
      const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?${queryParams}`);
      const data = await response.json();

      if (data.status === 'OK' && data.predictions?.length) {
        data.predictions.forEach(p => {
          allResults.push({
            id: p.place_id,
            description: p.description,
            placeName: p.description,
            mainText: p.structured_formatting?.main_text || '',
            secondaryText: p.structured_formatting?.secondary_text || '',
            source: 'google'
          });
        });
      }
    } catch (error) {
      console.warn('Google suggestions error', error);
    }
  }

  // 2. Fetch Mapbox Geocoding (as primary supplement)
  if (MAPBOX_TOKEN) {
    try {
      const params = {
        access_token: MAPBOX_TOKEN,
        autocomplete: 'true',
        types: 'address,place,locality,poi',
        limit: '10',
      };

      if (userLocation) {
        params.proximity = `${userLocation.longitude},${userLocation.latitude}`;
      }

      const queryParams = new URLSearchParams(params);
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(cleaned)}.json?${queryParams}`
      );
      const data = await response.json();

      if (data.features?.length) {
        data.features.forEach(f => {
          const description = f.place_name;
          // Only skip if the EXACT SAME ID already exists
          if (!allResults.some(r => r.id === f.id)) {
            allResults.push({
              id: f.id,
              description: description,
              placeName: description,
              latitude: Number(f.center?.[1]),
              longitude: Number(f.center?.[0]),
              mainText: f.text,
              secondaryText: description.replace(f.text + ', ', ''),
              source: 'mapbox'
            });
          }
        });
      }
    } catch (error) {
      console.warn('Mapbox suggestions error', error);
    }
  }

  // Return limited unique results
  return allResults.slice(0, 15);
}
