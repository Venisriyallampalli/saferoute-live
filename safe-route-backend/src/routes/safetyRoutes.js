const express = require('express');
const router = express.Router();
const safetyController = require('../controllers/safetyController');
const { requireAuth } = require('../middleware/auth');

// Note: Some GET routes don't strictly require authentication 
// to ensure maps load even if session has expired, but reporting DOES.

// 1. Hazards Layer (Map markers)
router.get('/hazards', safetyController.getNearbyHazards);
router.post('/hazards', requireAuth, safetyController.reportHazard);

// 2. Social & Situational Feed (Dashboard)
router.get('/feed', safetyController.getRecentFeed);
router.post('/feed', requireAuth, safetyController.postToFeed);

// 3. Fusion Analytics (Mock/Simulation layer for now)
router.get('/fusion/stats', safetyController.getFusionStats);
router.get('/incidents', safetyController.getLiveIncidents);

// 4. Route Safety Scoring Engine (rule-based)
router.post('/route-score', safetyController.scoreRoutes);

module.exports = router;
