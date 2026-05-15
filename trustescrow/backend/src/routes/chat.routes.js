const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');

router.get('/rooms', protect, (req, res) => {
  res.json({ success: true, message: 'Chat rooms' });
});

router.get('/messages/:roomId', protect, (req, res) => {
  res.json({ success: true, message: 'Messages retrieved' });
});

module.exports = router;
