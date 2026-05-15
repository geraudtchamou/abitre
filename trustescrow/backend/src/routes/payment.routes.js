const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth.middleware');

router.post('/stripe/webhook', async (req, res) => {
  // Handle Stripe webhook
  res.json({ success: true, message: 'Webhook received' });
});

router.post('/create-intent', protect, async (req, res) => {
  res.json({ success: true, message: 'Payment intent created' });
});

module.exports = router;
