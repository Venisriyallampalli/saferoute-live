const ChatMessage = require('../models/ChatMessage');
const { buildSafetyContext, generateGeminiSafetyReply, buildFallbackReply } = require('../utils/geminiChatService');

function toPublicMessage(doc) {
  const message = doc?.toObject ? doc.toObject() : doc;
  const senderId = String(message?.senderId || 'system');
  const senderName = message?.senderName || (message?.senderRole === 'assistant' ? 'SafeRoute AI' : 'User');

  return {
    _id: String(message?._id),
    sessionId: message?.sessionId,
    message: message?.message,
    messageType: message?.messageType || 'text',
    sender: {
      _id: senderId,
      name: senderName,
    },
    senderName,
    senderRole: message?.senderRole,
    location: message?.location || null,
    createdAt: message?.createdAt,
    updatedAt: message?.updatedAt,
  };
}

async function getRecentMessages(sessionId, limit = 50, before = null) {
  const query = { sessionId };
  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const docs = await ChatMessage.find(query)
    .sort({ createdAt: -1 })
    .limit(safeLimit)
    .lean();

  return docs.reverse();
}

exports.getMessages = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { limit = 50, before = null } = req.query;

    const docs = await getRecentMessages(sessionId, limit, before);
    return res.json({ messages: docs.map(toPublicMessage) });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch chat messages', error: error.message });
  }
};

exports.postMessage = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message, messageType = 'text', location = null } = req.body || {};

    if (!String(message || '').trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }

    const userId = String(req.user?.id || 'local-user');
    const senderName = req.user?.name || 'You';

    const userDoc = await ChatMessage.create({
      sessionId,
      message: String(message).trim(),
      messageType,
      senderRole: 'user',
      senderId: userId,
      senderName,
      location: location && Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude))
        ? {
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
          }
        : undefined,
      readBy: [userId],
    });

    const publicUserMessage = toPublicMessage(userDoc);

    const io = req.app.get('socketio');
    if (io) {
      io.emit('chat:newMessage', publicUserMessage);
    }

    const recentDocs = await getRecentMessages(sessionId, 12, null);
    const latestLocationMessage = [...recentDocs]
      .reverse()
      .find((item) => Number.isFinite(Number(item?.location?.latitude)) && Number.isFinite(Number(item?.location?.longitude)));

    const contextLocation = publicUserMessage.location || latestLocationMessage?.location || null;
    const context = await buildSafetyContext({
      location: contextLocation,
      now: new Date(),
    }).catch(() => ({ hasLocation: false }));

    let aiReply = null;
    try {
      aiReply = await generateGeminiSafetyReply({
        userMessage: publicUserMessage.message,
        recentMessages: recentDocs,
        context,
      });
    } catch (error) {
      aiReply = {
        text: buildFallbackReply(publicUserMessage.message, context),
        provider: 'fallback',
        usedModel: null,
      };
    }

    let aiMessage = null;
    if (aiReply?.text) {
      const aiDoc = await ChatMessage.create({
        sessionId,
        message: aiReply.text,
        messageType: 'text',
        senderRole: 'assistant',
        senderId: 'ai-assistant',
        senderName: 'SafeRoute AI',
        readBy: [userId],
      });

      aiMessage = toPublicMessage(aiDoc);

      if (io) {
        io.emit('chat:newMessage', aiMessage);
      }
    }

    return res.status(201).json({
      message: publicUserMessage,
      aiMessage,
      aiMeta: {
        provider: aiReply?.provider || 'fallback',
        model: aiReply?.usedModel || null,
        error: aiReply?.error || null,
        usedContextLocation: Boolean(contextLocation),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to send chat message', error: error.message });
  }
};

exports.markRead = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const readerId = String(req.user?.id || 'local-user');

    await ChatMessage.updateMany(
      { sessionId, readBy: { $ne: readerId } },
      { $addToSet: { readBy: readerId } }
    );

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to mark chat as read', error: error.message });
  }
};

exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    await ChatMessage.findByIdAndDelete(messageId);
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete message', error: error.message });
  }
};
