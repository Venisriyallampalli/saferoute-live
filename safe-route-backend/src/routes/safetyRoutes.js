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
router.get('/fusion/stats', (req, res) => {
   // In a real implementation, this would aggregate traffic & places API data.
   // Providing a baseline score for the dashboard gauges
   const baseCrowd = 45 + Math.floor(Math.random() * 20);
   const baseTraffic = 50 + Math.floor(Math.random() * 25);
   
   res.json({
      crowdDensity: baseCrowd,
      trafficFlow: baseTraffic,
      status: 'nominal',
      timestamp: new Date().toISOString()
   });
});

module.exports = router;
