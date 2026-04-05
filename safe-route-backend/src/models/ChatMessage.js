const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    messageType: {
      type: String,
      enum: ['text', 'location', 'system'],
      default: 'text',
      index: true,
    },
    senderRole: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
      index: true,
    },
    senderId: {
      type: String,
      default: null,
    },
    senderName: {
      type: String,
      trim: true,
      default: null,
    },
    location: {
      latitude: Number,
      longitude: Number,
    },
    readBy: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

chatMessageSchema.index({ sessionId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
