const express = require('express');
const { startLiveShare, updateLiveLocation, getLiveLocation, stopLiveShare } = require('../controllers/liveShareController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/live/start
// @desc    Start a new live location sharing session
// @access  Private
router.post('/start', requireAuth, startLiveShare);

// @route   POST /api/live/update/:sessionId
// @desc    Update the location for a live session
// @access  Private
router.post('/update/:sessionId', requireAuth, updateLiveLocation);

// @route   GET /api/live/:sessionId
// @desc    Get the current location for a live session
// @access  Public
router.get('/:sessionId', getLiveLocation);

// @route   POST /api/live/stop/:sessionId
// @desc    Stop a live location sharing session
// @access  Private
router.post('/stop/:sessionId', requireAuth, stopLiveShare);

module.exports = router;
