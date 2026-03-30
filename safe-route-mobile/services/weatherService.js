import { WEATHER_API_KEY } from '../utils/config';

const weatherRiskCache = new Map();

export function mapWeatherConditionToRisk(condition = '') {
  const normalized = String(condition).toLowerCase();

  if (normalized.includes('fog') || normalized.includes('mist') || normalized.includes('haze')) {
    return 0.8;
  }

  if (normalized.includes('rain') || normalized.includes('drizzle') || normalized.includes('thunder')) {
    return 0.7;
  }

  if (normalized.includes('clear')) {
    return 0.2;
  }

  return 0.4;
}

export async function getSegmentWeatherRisk(midpoint, apiKey = WEATHER_API_KEY) {
  if (!midpoint?.latitude || !midpoint?.longitude) {
    return 0.2;
  }

  // Coarser weather bucket improves scoring responsiveness for long routes.
  const cacheKey = `${midpoint.latitude.toFixed(1)}:${midpoint.longitude.toFixed(1)}`;
  if (weatherRiskCache.has(cacheKey)) {
    return weatherRiskCache.get(cacheKey);
  }

  if (!apiKey) {
    const fallback = 0.2;
    weatherRiskCache.set(cacheKey, fallback);
    return fallback;
  }

  try {
    const params = new URLSearchParams({
      lat: String(midpoint.latitude),
      lon: String(midpoint.longitude),
      appid: apiKey,
      units: 'metric',
    });

    const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?${params.toString()}`);
    if (!response.ok) {
      const fallback = 0.2;
      weatherRiskCache.set(cacheKey, fallback);
      return fallback;
    }

    const data = await response.json();
    const main = data?.weather?.[0]?.main || '';
    const risk = mapWeatherConditionToRisk(main);

    weatherRiskCache.set(cacheKey, risk);
    return risk;
  } catch (error) {
    const fallback = 0.2;
    weatherRiskCache.set(cacheKey, fallback);
    return fallback;
  }
}

export function clearWeatherRiskCache() {
  weatherRiskCache.clear();
}
