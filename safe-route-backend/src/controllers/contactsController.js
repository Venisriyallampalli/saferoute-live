const Contact = require('../models/Contact');

const MAX_CONTACTS = 10;

function normalizePhone(phone = '') {
  return String(phone).replace(/[^+\d]/g, '').trim();
}

function normalizeContactInput(input = {}) {
  const clientContactId = String(input.id || input._id || '').trim();
  const name = String(input.name || '').trim();
  const phone = normalizePhone(input.phone || '');

  return {
    clientContactId,
    name,
    phone,
    relation: String(input.relation || 'Trusted').trim() || 'Trusted',
    sourceContactId: input.sourceContactId ? String(input.sourceContactId) : null,
    createdAtClient: input.createdAt ? new Date(input.createdAt) : null,
  };
}

function toClientContact(doc) {
  return {
    id: doc.clientContactId,
    name: doc.name,
    phone: doc.phone,
    relation: doc.relation,
    sourceContactId: doc.sourceContactId || null,
    createdAt: doc.createdAtClient || doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

exports.getContacts = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const contacts = await Contact.find({ userId }).sort({ createdAt: 1 });

    return res.json({
      success: true,
      synced: true,
      contacts: contacts.map(toClientContact),
      count: contacts.length,
      max: MAX_CONTACTS,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      synced: false,
      message: 'Failed to fetch contacts',
      error: error.message,
    });
  }
};

exports.syncContacts = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const incoming = Array.isArray(req.body?.contacts) ? req.body.contacts : null;
    if (!incoming) {
      return res.status(400).json({
        success: false,
        synced: false,
        message: 'contacts array is required',
      });
    }

    if (incoming.length > MAX_CONTACTS) {
      return res.status(400).json({
        success: false,
        synced: false,
        message: `Maximum ${MAX_CONTACTS} emergency contacts allowed`,
      });
    }

    const normalized = incoming.map(normalizeContactInput);
    const valid = normalized.filter((item) => item.clientContactId && item.name && item.phone);

    const idSet = new Set(valid.map((item) => item.clientContactId));
    if (idSet.size !== valid.length) {
      return res.status(400).json({
        success: false,
        synced: false,
        message: 'Duplicate contact ids in payload',
      });
    }

    if (valid.length > MAX_CONTACTS) {
      return res.status(400).json({
        success: false,
        synced: false,
        message: `Maximum ${MAX_CONTACTS} emergency contacts allowed`,
      });
    }

    await Contact.deleteMany({ userId });

    if (valid.length) {
      await Contact.insertMany(
        valid.map((item) => ({
          userId,
          clientContactId: item.clientContactId,
          name: item.name,
          phone: item.phone,
          relation: item.relation,
          sourceContactId: item.sourceContactId,
          createdAtClient: item.createdAtClient,
        }))
      );
    }

    const saved = await Contact.find({ userId }).sort({ createdAt: 1 });

    return res.json({
      success: true,
      synced: true,
      contacts: saved.map(toClientContact),
      count: saved.length,
      max: MAX_CONTACTS,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      synced: false,
      message: 'Failed to sync contacts',
      error: error.message,
    });
  }
};
