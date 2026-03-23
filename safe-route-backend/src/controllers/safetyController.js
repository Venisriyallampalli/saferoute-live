const Hazard = require('../models/Hazard');
const SafeFeed = require('../models/SafeFeed');

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
