const express = require('express');
const router = express.Router();

const sosController = require('../controllers/sosController');
const { requireAuth } = require('../middleware/auth');

router.post('/trigger', requireAuth, sosController.triggerSos);
router.post('/update-location', requireAuth, sosController.updateSosLocation);
router.get('/active', requireAuth, sosController.getActiveSosAlerts);

module.exports = router;
