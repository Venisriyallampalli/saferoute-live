const SosAlert = require('../models/SosAlert');
const Contact = require('../models/Contact');

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function haversineMeters(a, b) {
  const r = 6371000;
  const dLat = toRadians((b.lat || 0) - (a.lat || 0));
  const dLon = toRadians((b.lon || 0) - (a.lon || 0));
  const lat1 = toRadians(a.lat || 0);
  const lat2 = toRadians(b.lat || 0);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * r * Math.asin(Math.sqrt(h));
}

function buildFallbackPolice(lat, lon) {
  const fallbackLocation = {
    lat: Number((lat + 0.01).toFixed(6)),
    lon: Number((lon + 0.01).toFixed(6)),
  };

  return {
    name: 'Nearest Police Station (Fallback)',
    location: fallbackLocation,
    distance_m: Math.round(haversineMeters({ lat, lon }, fallbackLocation)),
    source: 'fallback',
  };
}

async function findNearestPolice(lat, lon) {
  const placesKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!placesKey) {
    return buildFallbackPolice(lat, lon);
  }

  try {
    const params = new URLSearchParams({
      location: `${lat},${lon}`,
      radius: '5000',
      type: 'police',
      key: placesKey,
    });

    const response = await fetch(`https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`);
    const data = await response.json();

    if (!Array.isArray(data?.results) || data.results.length === 0) {
      return buildFallbackPolice(lat, lon);
    }

    const withDistance = data.results
      .map((item) => {
        const policeLat = Number(item?.geometry?.location?.lat);
        const policeLon = Number(item?.geometry?.location?.lng);

        if (!Number.isFinite(policeLat) || !Number.isFinite(policeLon)) {
          return null;
        }

        const distance = Math.round(
          haversineMeters(
            { lat, lon },
            { lat: policeLat, lon: policeLon }
          )
        );

        return {
          name: item.name || 'Police Station',
          location: { lat: policeLat, lon: policeLon },
          distance_m: distance,
          source: 'google',
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.distance_m - b.distance_m);

    return withDistance[0] || buildFallbackPolice(lat, lon);
  } catch (error) {
    return buildFallbackPolice(lat, lon);
  }
}

function buildSmsBody(lat, lon) {
  return `SOS Alert! User needs help: https://maps.google.com/?q=${lat},${lon}`;
}

exports.triggerSos = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { latitude, longitude, timestamp } = req.body || {};

    const lat = Number(latitude);
    const lon = Number(longitude);
    const eventTime = timestamp ? new Date(timestamp) : new Date();

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required' });
    }

    if (Number.isNaN(eventTime.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid timestamp' });
    }

    const nearestPolice = await findNearestPolice(lat, lon);
    const contacts = await Contact.find({ userId }).limit(10);

    const alert = await SosAlert.create({
      user_id: userId,
      lat,
      lon,
      timestamp: eventTime,
      status: 'active',
      nearest_police: nearestPolice,
      notifications: {
        smsStatus: 'not_configured',
        smsCount: contacts.length,
      },
      location_updates: [{ lat, lon, timestamp: eventTime }],
    });

    return res.status(201).json({
      success: true,
      message: 'SOS activated',
      alert_id: alert._id,
      status: alert.status,
      nearest_police: nearestPolice,
      emergency_sms: {
        status: 'not_configured',
        count: contacts.length,
        message: buildSmsBody(lat, lon),
        contacts: contacts.map((c) => ({ name: c.name, phone: c.phone })),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to trigger SOS',
      error: error.message,
    });
  }
};

exports.updateSosLocation = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { alert_id: alertId, latitude, longitude, timestamp } = req.body || {};

    const lat = Number(latitude);
    const lon = Number(longitude);
    const eventTime = timestamp ? new Date(timestamp) : new Date();

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!alertId) {
      return res.status(400).json({ success: false, message: 'alert_id is required' });
    }

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ success: false, message: 'Valid latitude and longitude are required' });
    }

    if (Number.isNaN(eventTime.getTime())) {
      return res.status(400).json({ success: false, message: 'Invalid timestamp' });
    }

    const alert = await SosAlert.findOne({ _id: alertId, user_id: userId, status: 'active' });
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Active SOS alert not found' });
    }

    alert.lat = lat;
    alert.lon = lon;
    alert.location_updates.push({ lat, lon, timestamp: eventTime });
    await alert.save();

    return res.json({
      success: true,
      message: 'SOS location updated',
      alert_id: alert._id,
      status: alert.status,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update SOS location',
      error: error.message,
    });
  }
};

exports.getActiveSosAlerts = async (_req, res) => {
  try {
    const alerts = await SosAlert.find({ status: 'active' }).sort({ createdAt: -1 }).limit(100);
    return res.json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch active SOS alerts',
      error: error.message,
    });
  }
};
