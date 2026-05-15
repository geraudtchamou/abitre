const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const db = require('../config/database');

// Get admin dashboard stats
router.get('/stats', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const totalUsers = await db.query(`SELECT COUNT(*) FROM users`);
    const totalEscrows = await db.query(`SELECT COUNT(*) FROM escrows`);
    const totalVolume = await db.query(`SELECT SUM(amount) as volume FROM escrows WHERE status = 'completed'`);
    const activeDisputes = await db.query(`SELECT COUNT(*) FROM disputes WHERE status IN ('open', 'under_review')`);
    
    res.json({
      totalUsers: parseInt(totalUsers.rows[0].count),
      totalEscrows: parseInt(totalEscrows.rows[0].count),
      totalVolume: parseFloat(totalVolume.rows[0].volume || 0),
      activeDisputes: parseInt(activeDisputes.rows[0].count)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get revenue analytics
router.get('/revenue', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    
    const result = await db.query(
      `SELECT DATE(created_at) as date, SUM(fee_amount) as revenue 
       FROM fees 
       WHERE created_at > NOW() - INTERVAL '${days} days'
       GROUP BY DATE(created_at)
       ORDER BY date DESC`
    );
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manage users (ban/suspend)
router.post('/users/:userId/status', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body; // status: 'active', 'suspended', 'banned'
    
    await db.query(
      `UPDATE users SET status = $1, suspension_reason = $2 WHERE id = $3`,
      [status, reason, userId]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Configure platform fees
router.post('/fees', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { escrowFeePercent, arbitrationFee, withdrawalFee } = req.body;
    
    await db.query(
      `INSERT INTO fee_config (escrow_fee_percent, arbitration_fee, withdrawal_fee, updated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET 
         escrow_fee_percent = $1, arbitration_fee = $2, withdrawal_fee = $3, updated_at = NOW()`
    , [escrowFeePercent, arbitrationFee, withdrawalFee, req.user.id]);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get audit logs
router.get('/audit-logs', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await db.query(
      `SELECT al.*, u.username as actor 
       FROM audit_logs al
       JOIN users u ON al.actor_id = u.id
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Freeze escrow (Admin/Moderator)
router.post('/escrows/:escrowId/freeze', authMiddleware, roleMiddleware('admin', 'moderator'), async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { reason } = req.body;
    
    await db.query(
      `UPDATE escrows SET status = 'frozen', frozen_reason = $1 WHERE id = $2`,
      [reason, escrowId]
    );
    
    await db.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
       VALUES ($1, 'freeze_escrow', 'escrow', $2, $3)`,
      [req.user.id, escrowId, JSON.stringify({ reason })]
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
