const Hazard = require('../models/Hazard');
const SafeFeed = require('../models/SafeFeed');
const { createSafetyScorer } = require('../utils/safetyScoring/scorerFactory');
const { fetchWeatherSnapshot, convertWeatherToRisk } = require('../utils/safetyScoring/weatherService');
const {
  getRouteMidpoint,
  normalizeRouteCoordinates,
  clamp01,
  haversineDistanceMeters,
} = require('../utils/safetyScoring/helpers');
const {
  getLiveFusionStats,
  getLiveIncidentsNearPoint,
  getIncidentRiskNearPoint,
} = require('../utils/tomtomTrafficService');

function mapSeverityToRisk(severity = 'Medium') {
  const normalized = String(severity).toLowerCase();
  if (normalized === 'high') return 0.35;
  if (normalized === 'medium') return 0.2;
  return 0.1;
}

exports.getFusionStats = async (req, res) => {
  try {
    const stats = await getLiveFusionStats();
    return res.json(stats);
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch fusion stats',
      error: error.message,
    });
  }
};

exports.getLiveIncidents = async (req, res) => {
  try {
    const lat = Number(req.query.lat ?? process.env.TOMTOM_FLOW_CENTER_LAT ?? 17.3850);
    const lng = Number(req.query.lng ?? process.env.TOMTOM_FLOW_CENTER_LNG ?? 78.4867);
    const radiusKm = Number(req.query.radius_km ?? 3);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: 'Invalid lat/lng query params' });
    }

    const incidents = await getLiveIncidentsNearPoint({
      latitude: lat,
      longitude: lng,
      radiusKm,
    });

    return res.json({
      incidents,
      count: incidents.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch live incidents',
      error: error.message,
    });
  }
};

/**
 * Report a new hazard (from mobile/admin)
 */
exports.reportHazard = async (req, res) => {
  try {
    const { type, description, latitude, longitude, address, severity, source } = req.body;

    if (!type || !latitude || !longitude) {
      return res.status(400).json({ message: 'Missing type or coordinates' });
    }

    const hazard = new Hazard({
      type,
      description,
      location: {
         type: 'Point',
         coordinates: [longitude, latitude],
      },
      address,
      severity: severity || 'Medium',
      source: source || 'mobile',
      reporterId: req.user?.id || null, // Assuming auth middleware provides req.user
    });

    await hazard.save();

    // Broadcast through socket (handled in server init ideally, but we'll return it)
    res.status(201).json({ success: true, hazard });
  } catch (error) {
    res.status(500).json({ message: 'Failed to report hazard', error: error.message });
  }
};

/**
 * Get hazards near a specific location (for map scoring)
 */
exports.getNearbyHazards = async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query; // Default 5km radius

    if (!lat || !lng) {
      return res.status(400).json({ message: 'Missing location query parameters' });
    }

    const hazards = await Hazard.find({
      location: {
        $near: {
          $geometry: {
             type: 'Point',
             coordinates: [parseFloat(lng), parseFloat(lat)],
          },
          $maxDistance: parseInt(radius),
        },
      },
      isActive: true,
    }).limit(50);

    res.json({ hazards });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch hazards', error: error.message });
  }
};

/**
 * Get social feed for a specific region
 */
exports.getRecentFeed = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    // Find feed posts within 10km, sorted by newest
    const filter = (lat && lng) ? {
       location: {
         $near: {
           $geometry: { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
           $maxDistance: 10000,
         }
       }
    } : {};

    const feed = await SafeFeed.find(filter).sort({ createdAt: -1 }).limit(20);
    res.json({ feed });
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch feed', error: error.message });
  }
};

/**
 * Post a situational update to the social feed
 */
exports.postToFeed = async (req, res) => {
  try {
    const { message, area, latitude, longitude, author, type } = req.body;

    const post = new SafeFeed({
      message,
      area,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
      author,
      type: type || 'info',
    });

    await post.save();
    res.status(201).json({ success: true, post });
  } catch (error) {
    res.status(500).json({ message: 'Failed to post to feed', error: error.message });
  }
};

/**
 * Score one or more routes with the rule-based safety engine.
 */
exports.scoreRoutes = async (req, res) => {
  try {
    const {
      routes,
      route,
      transport_mode: transportModeFromBody,
      weather_api_key: providedWeatherApiKey,
      scorer = 'rule-based',
      segment_length_m: segmentLengthMeters,
      now,
    } = req.body || {};

    const candidateRoutes = Array.isArray(routes)
      ? routes
      : route
        ? [route]
        : [];

    if (candidateRoutes.length === 0) {
      return res.status(400).json({
        message: 'Provide at least one route with coordinates',
      });
    }

    const weatherApiKey = providedWeatherApiKey || process.env.WEATHER_API_KEY;

    const scorerImpl = createSafetyScorer(scorer);
    const effectiveNow = now ? new Date(now) : new Date();

    if (Number.isNaN(effectiveNow.getTime())) {
      return res.status(400).json({
        message: 'Invalid now value. Provide a valid ISO timestamp if supplied.',
      });
    }

    const weatherRiskCache = new Map();
    const weatherRiskPromiseCache = new Map();
    const hazardRiskCache = new Map();
    const hazardRiskPromiseCache = new Map();

    const scoredRoutes = await Promise.all(candidateRoutes.map(async (currentRoute) => {
      const effectiveTransportMode =
        currentRoute.transport_mode ||
        currentRoute.transportMode ||
        transportModeFromBody ||
        'car';

      const coordinates = normalizeRouteCoordinates(currentRoute.coordinates);

      if (coordinates.length < 2) {
        return res.status(400).json({
          message: 'Each route must include at least 2 coordinate points',
        });
      }

      const midpoint = getRouteMidpoint(coordinates);
      const routeIncidents = midpoint
        ? await getLiveIncidentsNearPoint({
            latitude: midpoint.latitude,
            longitude: midpoint.longitude,
            radiusKm: 4,
          }).catch(() => [])
        : [];

      const routeNearbyHazards = midpoint
        ? await Hazard.find({
            location: {
              $near: {
                $geometry: {
                  type: 'Point',
                  coordinates: [midpoint.longitude, midpoint.latitude],
                },
                $maxDistance: 5000,
              },
            },
            isActive: true,
          }).limit(200)
        : [];

      const getWeatherRisk = async (point) => {
        // Coarser bucket lowers external API fan-out and keeps scoring responsive.
        const cacheKey = `${point.latitude.toFixed(1)}:${point.longitude.toFixed(1)}`;
        if (weatherRiskCache.has(cacheKey)) {
          return weatherRiskCache.get(cacheKey);
        }

        if (weatherRiskPromiseCache.has(cacheKey)) {
          return weatherRiskPromiseCache.get(cacheKey);
        }

        const pending = (async () => {
          try {
            const weather = await fetchWeatherSnapshot({
              latitude: point.latitude,
              longitude: point.longitude,
              apiKey: weatherApiKey,
            });
            const risk = clamp01(convertWeatherToRisk(weather));
            weatherRiskCache.set(cacheKey, risk);
            return risk;
          } catch (error) {
            const fallbackRisk = 0.3;
            weatherRiskCache.set(cacheKey, fallbackRisk);
            return fallbackRisk;
          } finally {
            weatherRiskPromiseCache.delete(cacheKey);
          }
        })();

        weatherRiskPromiseCache.set(cacheKey, pending);
        return pending;
      };

      const getHazardRisk = async (point, meta = {}) => {
        const cacheKey = `${point.latitude.toFixed(3)}:${point.longitude.toFixed(3)}`;
        if (hazardRiskCache.has(cacheKey)) {
          return hazardRiskCache.get(cacheKey);
        }

        if (hazardRiskPromiseCache.has(cacheKey)) {
          return hazardRiskPromiseCache.get(cacheKey);
        }

        const pending = (async () => {
          try {
            const baseFallback = typeof meta.fallback === 'number' ? meta.fallback : 0.1;
            const nearbyHazards = routeNearbyHazards.filter((hazard) => {
              const coords = hazard?.location?.coordinates || [];
              const hazardPoint = {
                latitude: Number(coords[1]),
                longitude: Number(coords[0]),
              };

              if (!Number.isFinite(hazardPoint.latitude) || !Number.isFinite(hazardPoint.longitude)) {
                return false;
              }

              const meters = haversineDistanceMeters(point, hazardPoint);
              return meters <= 200;
            });

            const severityRisk = nearbyHazards.reduce((sum, hazard) => {
              const coords = hazard?.location?.coordinates || [];
              const hazardPoint = {
                latitude: Number(coords[1]),
                longitude: Number(coords[0]),
              };

              if (!Number.isFinite(hazardPoint.latitude) || !Number.isFinite(hazardPoint.longitude)) {
                return sum;
              }

              const meters = haversineDistanceMeters(point, hazardPoint);
              const distanceWeight = meters <= 80 ? 1 : meters <= 150 ? 0.6 : 0.35;
              return sum + (mapSeverityToRisk(hazard.severity) * distanceWeight);
            }, 0);

            const normalizedSeverity = Math.min(0.7, severityRisk);
            const incidentRisk = getIncidentRiskNearPoint(point, routeIncidents);
            const risk = clamp01(baseFallback + normalizedSeverity + incidentRisk);

            hazardRiskCache.set(cacheKey, risk);
            return risk;
          } catch (error) {
            const fallbackRisk = clamp01(typeof meta.fallback === 'number' ? meta.fallback : 0.15);
            hazardRiskCache.set(cacheKey, fallbackRisk);
            return fallbackRisk;
          } finally {
            hazardRiskPromiseCache.delete(cacheKey);
          }
        })();

        hazardRiskPromiseCache.set(cacheKey, pending);
        return pending;
      };

      let routeWeather = null;
      if (midpoint) {
        try {
          routeWeather = await fetchWeatherSnapshot({
            latitude: midpoint.latitude,
            longitude: midpoint.longitude,
            apiKey: weatherApiKey,
          });
        } catch (error) {
          routeWeather = null;
        }
      }

      const scored = scorerImpl.scoreRoute(currentRoute, {
        transportMode: effectiveTransportMode,
        weather: routeWeather || { condition: 'clear' },
        getWeatherRisk,
        getHazardRisk,
        hasCrimeData: false,
        hasWeatherData: Boolean(routeWeather && !routeWeather.fallback),
        hasHazardData: true,
        now: effectiveNow,
        segmentLengthMeters,
      });

      return {
        ...(await scored),
        ...(routeWeather
          ? {
              weather: {
                condition: routeWeather.rawCondition,
                description: routeWeather.description,
                visibility_m: routeWeather.visibilityMeters,
                rain_mm: routeWeather.rainVolume,
                temperature_c: routeWeather.temperatureCelsius,
              },
            }
          : {}),
        incidents_count: routeIncidents.length,
      };
    }));

    return res.json({
      scorer: 'rule-based',
      schema_version: '2026-03-transport-mode-v1',
      updated_at: new Date().toISOString(),
      routes: scoredRoutes,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to score routes',
      error: error.message,
    });
  }
};
