const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');

router.get('/:sessionId', chatController.getMessages);
router.post('/:sessionId', chatController.postMessage);
router.post('/:sessionId/read', chatController.markRead);
router.delete('/:messageId', chatController.deleteMessage);

module.exports = router;
