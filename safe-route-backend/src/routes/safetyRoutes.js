const express = require('express');
const router = express.Router();
const safetyController = require('../controllers/safetyController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Note: Some GET routes don't strictly require authentication 
// to ensure maps load even if session has expired, but reporting DOES.

// 1. Hazards Layer (Map markers)
router.get('/hazards', safetyController.getNearbyHazards);
router.post('/hazards', requireAuth, safetyController.reportHazard);
router.get('/admin/hazards', requireAuth, requireAdmin, safetyController.getAdminHazards);
router.patch('/admin/hazards/:hazardId', requireAuth, requireAdmin, safetyController.updateAdminHazard);

// 2. Social & Situational Feed (Dashboard)
router.get('/feed', safetyController.getRecentFeed);
router.post('/feed', requireAuth, safetyController.postToFeed);

// 3. Fusion Analytics (Mock/Simulation layer for now)
router.get('/fusion/stats', safetyController.getFusionStats);
router.get('/incidents', safetyController.getLiveIncidents);
router.get('/accidents/risk', safetyController.getAccidentRisk);
router.get('/accident-risk', safetyController.getAccidentRisk);
router.post('/accidents/bulk', requireAuth, safetyController.bulkUpsertAccidents);

// 4. Route Safety Scoring Engine (rule-based)
router.post('/route-score', safetyController.scoreRoutes);
router.post('/route-monitor', safetyController.monitorRouteRisk);

module.exports = router;
