const mongoose = require('mongoose');

const hazardSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: [
        'harassment',
        'accident',
        'lighting',
        'unsafe',
        'obstruction',
        'pothole',
        'flooding',
        'construction',
        'theft',
        'assault',
        'stray_animals',
        'poor_visibility',
      ],
    },
    description: {
      type: String,
      trim: true,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },
    address: String,
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // Allow anonymous or system-reported hazards
    },
    source: {
      type: String,
      enum: ['mobile', 'admin', 'ai'],
      default: 'mobile',
    },
    severity: {
      type: String,
      enum: ['Low', 'Medium', 'High'],
      default: 'Medium',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

hazardSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Hazard', hazardSchema);
