const mongoose = require('mongoose');

const sosLocationUpdateSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    timestamp: { type: Date, required: true },
  },
  { _id: false }
);

const sosAlertSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    lat: { type: Number, required: true },
    lon: { type: Number, required: true },
    timestamp: { type: Date, required: true },
    status: {
      type: String,
      enum: ['active', 'resolved'],
      default: 'active',
      index: true,
    },
    nearest_police: {
      name: { type: String, default: 'Fallback Police Station' },
      location: {
        lat: { type: Number, default: null },
        lon: { type: Number, default: null },
      },
      distance_m: { type: Number, default: null },
      source: { type: String, enum: ['google', 'fallback'], default: 'fallback' },
    },
    notifications: {
      smsStatus: { type: String, enum: ['pending', 'sent', 'not_configured'], default: 'pending' },
      smsCount: { type: Number, default: 0 },
    },
    location_updates: {
      type: [sosLocationUpdateSchema],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('SosAlert', sosAlertSchema);
