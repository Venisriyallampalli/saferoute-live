const { clamp01 } = require('./helpers');

async function fetchWeatherSnapshot({ latitude, longitude, apiKey }) {
  if (!apiKey) {
    return {
      rainVolume: 0,
      visibilityMeters: 10000,
      temperatureCelsius: 24,
      condition: 'clear',
      rawCondition: 'Clear',
      description: 'fallback-clear',
      fallback: true,
    };
  }

  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    appid: apiKey,
    units: 'metric',
  });

  const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?${params.toString()}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Weather API request failed (${response.status}): ${body}`);
  }

  const data = await response.json();
  const condition = (data.weather?.[0]?.main || '').toLowerCase();

  return {
    rainVolume: Number(data.rain?.['1h'] || data.rain?.['3h'] || 0),
    visibilityMeters: Number(data.visibility || 10000),
    temperatureCelsius: Number(data.main?.temp ?? 24),
    condition,
    rawCondition: data.weather?.[0]?.main || 'Unknown',
    description: data.weather?.[0]?.description || '',
  };
}

function convertWeatherToRisk(snapshot) {
  let risk = 0.3;
  const condition = (snapshot.condition || '').toLowerCase();

  if (condition.includes('rain') || snapshot.rainVolume > 0) {
    risk = Math.max(risk, 0.7);
  }

  if (
    condition.includes('fog') ||
    condition.includes('mist') ||
    condition.includes('haze') ||
    condition.includes('smoke')
  ) {
    risk = Math.max(risk, 0.8);
  }

  if (condition.includes('clear')) {
    risk = Math.min(risk, 0.2);
  }

  if (snapshot.visibilityMeters < 1000) {
    risk += 0.3;
  } else if (snapshot.visibilityMeters < 4000) {
    risk += 0.2;
  } else if (snapshot.visibilityMeters < 8000) {
    risk += 0.1;
  }

  if (snapshot.temperatureCelsius < 0 || snapshot.temperatureCelsius > 38) {
    risk += 0.1;
  }

  return clamp01(risk);
}

module.exports = {
  fetchWeatherSnapshot,
  convertWeatherToRisk,
};
