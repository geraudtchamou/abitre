const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth.middleware');

router.use(protect);
router.use(authorize('admin'));

router.get('/dashboard', (req, res) => {
  res.json({ success: true, message: 'Admin dashboard data' });
});

router.get('/users', (req, res) => {
  res.json({ success: true, message: 'All users' });
});

router.post('/users/:id/suspend', (req, res) => {
  res.json({ success: true, message: 'User suspended' });
});

module.exports = router;
