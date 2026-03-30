const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    clientContactId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 32,
    },
    relation: {
      type: String,
      trim: true,
      default: 'Trusted',
      maxlength: 60,
    },
    sourceContactId: {
      type: String,
      default: null,
    },
    createdAtClient: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

contactSchema.index({ userId: 1, clientContactId: 1 }, { unique: true });

module.exports = mongoose.model('Contact', contactSchema);
