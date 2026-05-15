const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');

// Get user dashboard data
router.get('/overview', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get wallet balance
    const wallet = await db.query(`SELECT balance FROM wallets WHERE user_id = $1`, [userId]);
    
    // Get active escrows count
    const activeEscrows = await db.query(
      `SELECT COUNT(*) FROM escrows WHERE (buyer_id = $1 OR seller_id = $1) AND status = 'active'`,
      [userId]
    );
    
    // Get pending disputes
    const disputes = await db.query(
      `SELECT COUNT(*) FROM disputes WHERE (creator_id = $1 OR seller_id = $1) AND status IN ('open', 'under_review')`,
      [userId]
    );
    
    // Get recent transactions
    const recentTx = await db.query(
      `SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );
    
    // Get trust score
    const user = await db.query(`SELECT trust_score FROM users WHERE id = $1`, [userId]);
    
    // Get earnings/spending (last 30 days)
    const analytics = await db.query(
      `SELECT 
         SUM(CASE WHEN type IN ('deposit', 'transfer_in', 'release_in') THEN amount ELSE 0 END) as earnings,
         SUM(CASE WHEN type IN ('withdrawal', 'transfer_out', 'escrow_fund') THEN amount ELSE 0 END) as spending
       FROM wallet_transactions
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [userId]
    );
    
    res.json({
      balance: wallet.rows[0]?.balance || 0,
      activeEscrows: parseInt(activeEscrows.rows[0].count),
      pendingDisputes: parseInt(disputes.rows[0].count),
      trustScore: user.rows[0]?.trust_score || 0,
      recentTransactions: recentTx.rows,
      analytics: analytics.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get escrow analytics
router.get('/escrows/analytics', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const stats = await db.query(
      `SELECT 
         status, COUNT(*) as count, SUM(amount) as total
       FROM escrows
       WHERE buyer_id = $1 OR seller_id = $1
       GROUP BY status`,
      [userId]
    );
    
    res.json(stats.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get monthly revenue chart data
router.get('/revenue-chart', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { months = 6 } = req.query;
    
    const data = await db.query(
      `SELECT 
         TO_CHAR(created_at, 'YYYY-MM') as month,
         SUM(CASE WHEN type IN ('deposit', 'transfer_in', 'release_in') THEN amount ELSE 0 END) as income,
         SUM(CASE WHEN type IN ('withdrawal', 'transfer_out', 'escrow_fund') THEN amount ELSE 0 END) as expense
       FROM wallet_transactions
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '${months} months'
       GROUP BY TO_CHAR(created_at, 'YYYY-MM')
       ORDER BY month`,
      [userId]
    );
    
    res.json(data.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
