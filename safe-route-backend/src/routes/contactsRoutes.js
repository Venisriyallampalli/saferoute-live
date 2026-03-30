const express = require('express');
const router = express.Router();

const contactsController = require('../controllers/contactsController');
const { requireAuth } = require('../middleware/auth');

router.get('/', requireAuth, contactsController.getContacts);
router.post('/sync', requireAuth, contactsController.syncContacts);

module.exports = router;
