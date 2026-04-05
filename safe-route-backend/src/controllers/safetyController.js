const Hazard = require('../models/Hazard');
const AccidentEvent = require('../models/AccidentEvent');
const SafeFeed = require('../models/SafeFeed');
const { createSafetyScorer } = require('../utils/safetyScoring/scorerFactory');
const { fetchWeatherSnapshot, convertWeatherToRisk } = require('../utils/safetyScoring/weatherService');
const {
  fetchProtectivePoisNearPoint,
  getProtectiveScoreNearPoint,
  summarizeProtectivePois,
} = require('../utils/safetyScoring/protectiveFactorsService');
const {
  computeAccidentRiskNearPoint,
  computeAccidentFeatureVector,
  resolveEngineeredFields,
} = require('../utils/safetyScoring/accidentRiskService');
const {
  chooseAoPolicy,
  computeTraversalCost,
  estimateRemainingHeuristic,
  chooseRouteByAoPolicy,
} = require('../utils/safetyScoring/searchHeuristics');
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
  fetchTomTomFlowStats,
} = require('../utils/tomtomTrafficService');

function mapSeverityToRisk(severity = 'Medium') {
  const normalized = String(severity).toLowerCase();
  if (normalized === 'high') return 0.35;
  if (normalized === 'medium') return 0.2;
  return 0.1;
}

function estimateCrowdRisk({ flowPercent = null, night = false, nearbyIncidentRisk = 0 }) {
  const normalizedFlow = Number.isFinite(Number(flowPercent))
    ? clamp01(Number(flowPercent) / 100)
    : 0.45;

  // Mid crowd (around 0.55) is usually safer than very isolated or chaotic conditions.
  const crowdDeviationRisk = clamp01(Math.abs(normalizedFlow - 0.55) / 0.55);
  const isolationPenalty = night && normalizedFlow < 0.35 ? 0.18 : 0;
  return clamp01((crowdDeviationRisk * 0.65) + (clamp01(nearbyIncidentRisk) * 0.35) + isolationPenalty);
}

function parseIsoOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toNumber(value) {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return parsed;

  const raw = String(value || '').trim();
  if (!raw) return null;

  const cleaned = raw.replace(/\s+/g, '').replace(/[^0-9+\-.]/g, '');
  if (!cleaned) return null;

  const sign = cleaned.startsWith('-') ? '-' : '';
  let body = cleaned.replace(/^[+-]/, '');
  const firstDot = body.indexOf('.');
  if (firstDot >= 0) {
    body = `${body.slice(0, firstDot + 1)}${body.slice(firstDot + 1).replace(/\./g, '')}`;
  }

  const recovered = Number(`${sign}${body}`);
  return Number.isFinite(recovered) ? recovered : null;
}

function mapAccidentRecord(input = {}) {
  const lat = toNumber(input.latitude ?? input.lat);
  const lng = toNumber(input.longitude ?? input.lng ?? input.logitude);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const occurredAt = parseIsoOrNull(input.occurredAt ?? input.occurred_at ?? input.timestamp);
  const timeWindow = String(input.timeWindow ?? input['Time of Accident'] ?? '').trim() || null;
  const severity = String(input.severity ?? input['Accident Severity'] ?? 'Minor Injury').trim();
  const vehicleType = String(input.vehicleType ?? input['Vehicle Type'] ?? '').trim() || null;
  const engineered = resolveEngineeredFields({
    occurredAt,
    timeWindow,
    severity,
    vehicleType,
    hourBin: input.hourBin,
    isNight: input.isNight,
    severityWeight: input.severityWeight,
    recencyWeight: input.recencyWeight,
    vulnerableVehicleWeight: input.vulnerableVehicleWeight,
  });

  return {
    sourceRecordId: String(input.sourceRecordId ?? input['Sl.No'] ?? input['S1.No'] ?? input.serial ?? '').trim() || null,
    year: Number(input.year ?? input.Year) || null,
    policeStation: String(input.policeStation ?? input['Name of the PS'] ?? input.ps ?? '').trim() || null,
    accidentDateText: String(input.accidentDateText ?? input['Road Accidents Data'] ?? input.datetime ?? '').trim() || null,
    occurredAt,
    place: String(input.place ?? input['Place of Accident'] ?? '').trim() || null,
    location: {
      type: 'Point',
      coordinates: [lng, lat],
    },
    severity,
    roadType: String(input.roadType ?? input['Road Type'] ?? '').trim() || null,
    vehicleType,
    timeWindow,
    hourBin: engineered.hourBin,
    isNight: engineered.isNight,
    severityWeight: engineered.severityWeight,
    recencyWeight: engineered.recencyWeight,
    vulnerableVehicleWeight: engineered.vulnerableVehicleWeight,
    isActive: input.isActive !== false,
    metadata: {
      raw: input,
    },
  };
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

exports.bulkUpsertAccidents = async (req, res) => {
  try {
    const records = Array.isArray(req.body?.records) ? req.body.records : [];
    if (!records.length) {
      return res.status(400).json({ message: 'Provide records array in request body' });
    }

    const operations = [];
    let skipped = 0;

    records.forEach((record) => {
      const mapped = mapAccidentRecord(record);
      if (!mapped) {
        skipped += 1;
        return;
      }

      const filter = mapped.sourceRecordId
        ? { sourceRecordId: mapped.sourceRecordId }
        : {
            'location.coordinates.0': mapped.location.coordinates[0],
            'location.coordinates.1': mapped.location.coordinates[1],
            severity: mapped.severity,
            accidentDateText: mapped.accidentDateText,
          };

      operations.push({
        updateOne: {
          filter,
          update: {
            $set: mapped,
          },
          upsert: true,
        },
      });
    });

    if (!operations.length) {
      return res.status(400).json({ message: 'No valid records with coordinates found' });
    }

    const result = await AccidentEvent.bulkWrite(operations, { ordered: false });

    return res.json({
      success: true,
      received: records.length,
      processed: operations.length,
      skipped,
      inserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
      matched: result.matchedCount || 0,
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to ingest accident records',
      error: error.message,
    });
  }
};

exports.getAccidentRisk = async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radiusMeters = Number(req.query.radius_m || 250);
    const roadType = String(req.query.road_type || 'unknown');

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: 'Invalid lat/lng query params' });
    }

    const accidents = await AccidentEvent.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat],
          },
          $maxDistance: Math.max(50, Math.min(5000, radiusMeters * 4)),
        },
      },
      isActive: true,
    }).limit(500);

    const featureVector = computeAccidentFeatureVector({
      point: { latitude: lat, longitude: lng },
      accidents,
      now: new Date(),
      roadType,
      radiusMeters,
    });

    const risk = computeAccidentRiskNearPoint({
      point: { latitude: lat, longitude: lng },
      accidents,
      now: new Date(),
      roadType,
      radiusMeters,
    });

    return res.json({
      risk: Number(risk.toFixed(3)),
      accident_count: accidents.length,
      radius_m: radiusMeters,
      features: {
        C: Number(featureVector.C.toFixed(3)),
        S: Number(featureVector.S.toFixed(3)),
        N: Number(featureVector.N.toFixed(3)),
        V: Number(featureVector.V.toFixed(3)),
        T: Number(featureVector.T.toFixed(3)),
      },
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      message: 'Failed to fetch accident risk',
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
 * Admin: list reported hazards for moderation dashboard
 */
exports.getAdminHazards = async (req, res) => {
  try {
    const { status = 'all', limit = 100 } = req.query;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 300);

    const filter = {};
    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'resolved') {
      filter.isActive = false;
    }

    const hazards = await Hazard.find(filter)
      .sort({ createdAt: -1 })
      .limit(parsedLimit)
      .populate('reporterId', 'name email role');

    return res.json({ hazards });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch admin hazards', error: error.message });
  }
};

/**
 * Admin: update hazard status/severity/description
 */
exports.updateAdminHazard = async (req, res) => {
  try {
    const { hazardId } = req.params;
    const { isActive, severity, description } = req.body || {};

    const updates = {};
    if (typeof isActive === 'boolean') {
      updates.isActive = isActive;
    }

    if (typeof severity === 'string') {
      updates.severity = severity;
    }

    if (typeof description === 'string') {
      updates.description = description.trim();
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'No valid updates provided' });
    }

    const hazard = await Hazard.findByIdAndUpdate(hazardId, updates, {
      new: true,
      runValidators: true,
    }).populate('reporterId', 'name email role');

    if (!hazard) {
      return res.status(404).json({ message: 'Hazard not found' });
    }

    return res.json({ success: true, hazard });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update hazard', error: error.message });
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
      search_policy: preferredPolicy,
      max_extra_time_percent: maxExtraTimePercent,
      min_safety_score: minSafetyScore,
      road_type_preference: roadTypePreference,
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
    const accidentRiskCache = new Map();
    const accidentRiskPromiseCache = new Map();
    const selectedPolicy = chooseAoPolicy({
      preferredMode: preferredPolicy,
      maxExtraTimePercent,
      minSafetyScore,
    });

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

      const routeNearbyAccidents = midpoint
        ? await AccidentEvent.find({
            location: {
              $near: {
                $geometry: {
                  type: 'Point',
                  coordinates: [midpoint.longitude, midpoint.latitude],
                },
                $maxDistance: 6000,
              },
            },
            isActive: true,
          }).limit(1500)
        : [];

      const routeProtectivePois = midpoint
        ? await fetchProtectivePoisNearPoint({
            latitude: midpoint.latitude,
            longitude: midpoint.longitude,
            radiusMeters: 4500,
          }).catch(() => [])
        : [];

      let routeFlowStats = null;
      if (midpoint && process.env.TOMTOM_API_KEY) {
        routeFlowStats = await fetchTomTomFlowStats({
          apiKey: process.env.TOMTOM_API_KEY,
          latitude: midpoint.latitude,
          longitude: midpoint.longitude,
        }).catch(() => null);
      }

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

      const getAccidentRisk = async (point, meta = {}) => {
        const cacheKey = `${point.latitude.toFixed(3)}:${point.longitude.toFixed(3)}:${meta.roadType || 'unknown'}`;
        if (accidentRiskCache.has(cacheKey)) {
          return accidentRiskCache.get(cacheKey);
        }

        if (accidentRiskPromiseCache.has(cacheKey)) {
          return accidentRiskPromiseCache.get(cacheKey);
        }

        const pending = (async () => {
          try {
            const risk = computeAccidentRiskNearPoint({
              point,
              accidents: routeNearbyAccidents,
              now: effectiveNow,
              roadType: meta.roadType,
              fallback: typeof meta.fallback === 'number' ? meta.fallback : 0.05,
            });

            accidentRiskCache.set(cacheKey, risk);
            return risk;
          } catch (error) {
            const fallbackRisk = clamp01(typeof meta.fallback === 'number' ? meta.fallback : 0.08);
            accidentRiskCache.set(cacheKey, fallbackRisk);
            return fallbackRisk;
          } finally {
            accidentRiskPromiseCache.delete(cacheKey);
          }
        })();

        accidentRiskPromiseCache.set(cacheKey, pending);
        return pending;
      };

      const getProtectiveScore = async (point, meta = {}) => {
        const baseFallback = typeof meta.fallback === 'number' ? meta.fallback : 0.2;
        if (!routeProtectivePois.length) return clamp01(baseFallback);
        const score = getProtectiveScoreNearPoint(point, routeProtectivePois);
        return clamp01(Math.max(baseFallback, score));
      };

      const getCrowdRisk = async (point, meta = {}) => {
        const baseFallback = typeof meta.fallback === 'number' ? meta.fallback : 0.18;
        const incidentRisk = getIncidentRiskNearPoint(point, routeIncidents);
        const flowPercent = routeFlowStats?.trafficFlow;
        const estimated = estimateCrowdRisk({
          flowPercent,
          night: Boolean(meta.night),
          nearbyIncidentRisk: incidentRisk,
        });

        return clamp01(Math.max(baseFallback, estimated));
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
        getAccidentRisk,
        getProtectiveScore,
        getCrowdRisk,
        hasWeatherData: Boolean(routeWeather && !routeWeather.fallback),
        hasHazardData: true,
        hasAccidentData: routeNearbyAccidents.length > 0,
        hasCrowdData: true,
        hasProtectiveData: routeProtectivePois.length > 0,
        now: effectiveNow,
        segmentLengthMeters,
      });

      const scoredResult = await scored;
      const routeRisk = clamp01(1 - ((scoredResult.safety_score || 0) / 100));
      const traversalCost = computeTraversalCost({
        distanceMeters: currentRoute.distanceMeters,
        durationSeconds: currentRoute.durationSeconds,
        riskScore: routeRisk,
        policy: selectedPolicy,
      });

      const destination = coordinates[coordinates.length - 1];
      const origin = coordinates[0];
      const straightLineMeters = haversineDistanceMeters(origin, destination);
      const riskDensityPerKm = clamp01(((scoredResult.factors?.accident || 0) + (scoredResult.factors?.hazard || 0)) / 2);
      const heuristicCost = estimateRemainingHeuristic({
        straightLineMeters,
        riskDensityPerKm,
        policy: selectedPolicy,
      });

      return {
        ...scoredResult,
        durationSeconds: currentRoute.durationSeconds,
        distanceMeters: currentRoute.distanceMeters,
        dominant_road_type: currentRoute.roadType || scoredResult?.ml_features?.road_type || null,
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
        accidents_count: routeNearbyAccidents.length,
        protective_poi_counts: summarizeProtectivePois(routeProtectivePois),
        crowd_meta: {
          traffic_flow_percent: Number(routeFlowStats?.trafficFlow ?? 45),
          source: routeFlowStats ? 'tomtom-flow' : 'fallback',
        },
        search_policy: selectedPolicy,
        search_heuristics: {
          astar_f: Number((traversalCost + heuristicCost).toFixed(4)),
          greedy_h: heuristicCost,
          traversal_cost_g: traversalCost,
          heuristic_h: heuristicCost,
          straight_line_m: Number(straightLineMeters.toFixed(2)),
          risk_density_per_km: Number(riskDensityPerKm.toFixed(3)),
        },
      };
    }));

    const aoDecision = chooseRouteByAoPolicy({
      routes: scoredRoutes,
      policy: selectedPolicy,
      constraints: {
        maxExtraTimePercent,
        minSafetyScore,
        preferredRoadType: roadTypePreference,
      },
    });

    return res.json({
      scorer: 'rule-based',
      schema_version: '2026-04-accident-heuristics-v1',
      search_policy: selectedPolicy,
      route_selection: {
        strategy: 'ao-policy-layer',
        recommended_route_id: aoDecision.recommendedRouteId,
        ranked_route_ids: aoDecision.rankedRouteIds,
      },
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
