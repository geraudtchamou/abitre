const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const db = require('../config/database');

// Get all users (Admin)
router.get('/', authMiddleware, roleMiddleware('admin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, role } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `SELECT id, username, email, role, status, trust_score, created_at FROM users WHERE 1=1`;
    const params = [];
    
    if (status) {
      params.push(status);
      query += ` AND status = $${params.length}`;
    }
    
    if (role) {
      params.push(role);
      query += ` AND role = $${params.length}`;
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await db.query(query, params);
    
    const total = await db.query(`SELECT COUNT(*) FROM users WHERE 1=1${status ? ' AND status = $1' : ''}`, status ? [status] : []);
    
    res.json({
      users: result.rows,
      total: parseInt(total.rows[0].count),
      page: parseInt(page),
      totalPages: Math.ceil(parseInt(total.rows[0].count) / parseInt(limit))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user details
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT id, username, email, role, status, trust_score, bio, avatar_url, created_at 
       FROM users WHERE id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get stats
    const stats = await db.query(
      `SELECT 
         (SELECT COUNT(*) FROM escrows WHERE buyer_id = $1 OR seller_id = $1) as total_transactions,
         (SELECT COUNT(*) FROM escrows WHERE (buyer_id = $1 OR seller_id = $1) AND status = 'completed') as completed,
         (SELECT AVG(rating) FROM reviews WHERE reviewed_id = $1) as avg_rating`,
      [id]
    );
    
    res.json({ ...result.rows[0], stats: stats.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { bio, avatarUrl } = req.body;
    
    const result = await db.query(
      `UPDATE users SET bio = $1, avatar_url = $2 WHERE id = $3 RETURNING id, username, email, bio, avatar_url`,
      [bio, avatarUrl, req.user.id]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search users
router.get('/search/:query', authMiddleware, async (req, res) => {
  try {
    const { query } = req.params;
    
    const result = await db.query(
      `SELECT id, username, avatar_url, trust_score 
       FROM users 
       WHERE username ILIKE $1 AND status = 'active'
       LIMIT 10`,
      [`%${query}%`]
    );
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
