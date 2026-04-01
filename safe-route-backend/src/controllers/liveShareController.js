const LiveShare = require('../models/LiveShare');
const { v4: uuidv4 } = require('uuid');

exports.startLiveShare = async (req, res) => {
  try {
    const userId = req.user.id;
    const sessionId = uuidv4();

    const initialPoint = {
      latitude: req.body.latitude,
      longitude: req.body.longitude,
      timestamp: new Date(),
    };

    const newSession = new LiveShare({
      userId,
      sessionId,
      lastLocation: initialPoint,
      path: [initialPoint],
    });

    await newSession.save();

    res.status(201).json({
      success: true,
      sessionId,
      shareUrl: `${req.protocol}://${req.get('host')}/live/${sessionId}`,
    });
  } catch (error) {
    console.error('Error starting live share:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.updateLiveLocation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { latitude, longitude } = req.body;

    const session = await LiveShare.findOne({ sessionId, isActive: true });

    if (!session) {
      return res.status(404).json({ message: 'Live session not found or has ended.' });
    }

    if (session.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'User not authorized to update this session.' });
    }

    const point = {
      latitude,
      longitude,
      timestamp: new Date(),
    };

    await LiveShare.updateOne(
      { sessionId, isActive: true },
      { $set: { lastLocation: point }, $push: { path: point } }
    );
    res.status(200).json({ success: true, message: 'Location updated.' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.getLiveLocation = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await LiveShare.findOne({ sessionId, isActive: true });

    if (!session) {
      return res.status(404).json({ message: 'Live session not found or has ended.' });
    }

    res.status(200).json({
      success: true,
      location: session.lastLocation,
      path: session.path || [],
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

exports.stopLiveShare = async (req, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.id;
  
      const session = await LiveShare.findOne({ sessionId, userId });
  
      if (!session) {
        return res.status(404).json({ message: 'Session not found.' });
      }
  
      session.isActive = false;
      session.stoppedAt = new Date();
      await session.save();
  
      res.status(200).json({ success: true, message: 'Live sharing stopped.' });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
};
