const { fetchWeatherSnapshot } = require('./safetyScoring/weatherService');
const Hazard = require('../models/Hazard');
const AccidentEvent = require('../models/AccidentEvent');
const { computeAccidentRiskNearPoint } = require('./safetyScoring/accidentRiskService');
const { getLiveIncidentsNearPoint, getIncidentRiskNearPoint } = require('./tomtomTrafficService');

function extractGeminiText(payload = {}) {
  const candidates = Array.isArray(payload?.candidates) ? payload.candidates : [];
  for (const candidate of candidates) {
    const parts = candidate?.content?.parts;
    if (!Array.isArray(parts)) continue;
    const text = parts.map((part) => part?.text).filter(Boolean).join('\n').trim();
    if (text) return text;
  }
  return null;
}

async function buildSafetyContext({ location, now = new Date() }) {
  if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
    return {
      hasLocation: false,
      hazardsCount: 0,
      incidentsCount: 0,
      accidentRisk: null,
      weather: null,
    };
  }

  const point = {
    latitude: Number(location.latitude),
    longitude: Number(location.longitude),
  };

  const [hazards, incidents, weather, accidents] = await Promise.all([
    Hazard.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [point.longitude, point.latitude],
          },
          $maxDistance: 2000,
        },
      },
      isActive: true,
    }).limit(120).lean().catch(() => []),
    getLiveIncidentsNearPoint({ latitude: point.latitude, longitude: point.longitude, radiusKm: 3 }).catch(() => []),
    fetchWeatherSnapshot({
      latitude: point.latitude,
      longitude: point.longitude,
      apiKey: process.env.WEATHER_API_KEY,
    }).catch(() => null),
    AccidentEvent.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [point.longitude, point.latitude],
          },
          $maxDistance: 3000,
        },
      },
      isActive: true,
    }).limit(300).lean().catch(() => []),
  ]);

  const incidentRisk = getIncidentRiskNearPoint(point, incidents);
  const accidentRisk = computeAccidentRiskNearPoint({
    point,
    accidents,
    now,
    radiusMeters: 250,
  });

  return {
    hasLocation: true,
    hazardsCount: hazards.length,
    incidentsCount: incidents.length,
    incidentRisk: Number(incidentRisk.toFixed(3)),
    accidentRisk: Number(accidentRisk.toFixed(3)),
    weather: weather
      ? {
          condition: weather.rawCondition,
          description: weather.description,
          temperatureCelsius: weather.temperatureCelsius,
        }
      : null,
  };
}

function buildFallbackReply(userMessage, context) {
  const text = String(userMessage || '').toLowerCase();
  const unsafeIntent = /(unsafe|not\s+safe|not\s+feeling\s+safe|help|danger|emergency|scared|threat|risk)/i.test(text);

  if (unsafeIntent) {
    return 'If you are in immediate danger, trigger SOS now and move toward a crowded, well-lit area near police or hospital.';
  }

  if (context?.hasLocation) {
    const riskSignals = [];
    if ((context.accidentRisk || 0) > 0.55) riskSignals.push('high accident history');
    if ((context.incidentRisk || 0) > 0.25) riskSignals.push('live traffic incidents');
    if ((context.hazardsCount || 0) > 5) riskSignals.push('multiple hazard reports');

    if (riskSignals.length) {
      return `Current area has ${riskSignals.join(', ')}. Prefer main roads, avoid isolated lanes, and keep live location sharing on.`;
    }

    return 'I can see your location context. Current signals look moderate, so stay on main roads, avoid isolated shortcuts, and keep live sharing and SOS ready.';
  }

  return 'Share your location in chat for a more accurate safety response. I can then provide localized risk guidance.';
}

async function generateGeminiSafetyReply({ userMessage, recentMessages = [], context = {} }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      text: buildFallbackReply(userMessage, context),
      provider: 'fallback',
      usedModel: null,
    };
  }

  const preferredModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
  const fallbackModels = String(process.env.GEMINI_FALLBACK_MODELS || 'gemini-2.5-flash,gemini-2.5-pro,gemini-2.0-flash-001')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const modelsToTry = [preferredModel, ...fallbackModels].filter((model, index, arr) => arr.indexOf(model) === index);

  const shortHistory = recentMessages.slice(-8).map((item) => {
    const role = item.senderRole === 'assistant' ? 'assistant' : 'user';
    return `${role}: ${item.message}`;
  }).join('\n');

  const prompt = [
    'You are SafeRoute AI, a concise safety assistant for urban navigation.',
    'Rules:',
    '- Keep response under 90 words.',
    '- Give practical, non-alarmist safety guidance.',
    '- If user seems at risk, suggest SOS and nearby safe public places.',
    '- Do not fabricate exact police/hospital names.',
    '- Use context signals when present.',
    `Context: ${JSON.stringify(context)}`,
    `Recent messages:\n${shortHistory || 'none'}`,
    `User message: ${userMessage}`,
  ].join('\n');

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ],
    generationConfig: {
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 512,
      responseMimeType: 'text/plain',
      thinkingConfig: {
        thinkingBudget: 0,
      },
    },
  };

  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS || 12000);
  const errors = [];

  for (const model of modelsToTry) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const raw = await response.text();
        errors.push(`${model}: http-${response.status}`);
        // Try next model.
        continue;
      }

      const payload = await response.json();
      const text = extractGeminiText(payload);
      if (text) {
        return {
          text,
          provider: 'gemini',
          usedModel: model,
          error: null,
        };
      }

      errors.push(`${model}: empty-response`);
    } catch (error) {
      const reason = error?.name === 'AbortError' ? 'timeout' : (error?.message || 'request-failed');
      errors.push(`${model}: ${reason}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    text: buildFallbackReply(userMessage, context),
    provider: 'fallback',
    usedModel: null,
    error: errors.join(' | ').slice(0, 500),
  };
}

module.exports = {
  buildSafetyContext,
  generateGeminiSafetyReply,
  buildFallbackReply,
};
