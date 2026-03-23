const mongoose = require('mongoose');

const safeFeedSchema = new mongoose.Schema(
  {
    author: {
       type: String,
       required: true,
       default: 'SafeRoute AI',
    },
    message: {
       type: String,
       required: true,
       trim: true,
    },
    type: {
       type: String,
       enum: ['info', 'alert', 'social', 'system'],
       default: 'info',
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
    area: String,
    expireAt: {
       type: Date,
       default: () => new Date(Date.now() + 2 * 60 * 60 * 1000), // Default 2 hours expiry
       index: { expires: 0 },
    },
  },
  { timestamps: true }
);

safeFeedSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('SafeFeed', safeFeedSchema);
