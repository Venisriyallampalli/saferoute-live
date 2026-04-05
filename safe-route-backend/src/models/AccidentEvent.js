const mongoose = require('mongoose');

const accidentEventSchema = new mongoose.Schema(
  {
    sourceRecordId: {
      type: String,
      index: true,
      default: null,
    },
    year: {
      type: Number,
      default: null,
    },
    policeStation: {
      type: String,
      trim: true,
      default: null,
    },
    accidentDateText: {
      type: String,
      trim: true,
      default: null,
    },
    occurredAt: {
      type: Date,
      default: null,
      index: true,
    },
    place: {
      type: String,
      trim: true,
      default: null,
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point',
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    severity: {
      type: String,
      trim: true,
      default: 'Minor Injury',
      index: true,
    },
    roadType: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    vehicleType: {
      type: String,
      trim: true,
      default: null,
    },
    timeWindow: {
      type: String,
      trim: true,
      default: null,
    },
    hourBin: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    isNight: {
      type: Boolean,
      default: false,
      index: true,
    },
    severityWeight: {
      type: Number,
      default: 0.4,
    },
    recencyWeight: {
      type: Number,
      default: 0.7,
    },
    vulnerableVehicleWeight: {
      type: Number,
      default: 0.2,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

accidentEventSchema.index({ location: '2dsphere' });
accidentEventSchema.index({ occurredAt: -1, severity: 1 });
accidentEventSchema.index({ roadType: 1, isActive: 1 });

module.exports = mongoose.model('AccidentEvent', accidentEventSchema);
