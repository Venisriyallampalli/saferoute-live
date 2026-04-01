const mongoose = require('mongoose');

const liveShareSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  sessionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLocation: {
    latitude: Number,
    longitude: Number,
    timestamp: Date,
  },
  path: [
    {
      latitude: Number,
      longitude: Number,
      timestamp: Date,
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 3600 * 8, // Automatically delete after 8 hours
  },
  stoppedAt: {
    type: Date,
  },
});

module.exports = mongoose.model('LiveShare', liveShareSchema);
