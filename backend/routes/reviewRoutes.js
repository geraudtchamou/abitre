const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');

// Get user reviews
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.query;
    const targetId = userId || req.user.id;
    
    const result = await db.query(
      `SELECT r.*, u.username as reviewer 
       FROM reviews r
       JOIN users u ON r.reviewer_id = u.id
       WHERE r.reviewed_id = $1
       ORDER BY r.created_at DESC`,
      [targetId]
    );
    
    // Calculate average rating
    const avgResult = await db.query(
      `SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM reviews WHERE reviewed_id = $1`,
      [targetId]
    );
    
    res.json({
      reviews: result.rows,
      averageRating: parseFloat(avgResult.rows[0].avg_rating || 0),
      totalReviews: parseInt(avgResult.rows[0].count)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit review
router.post('/', authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const { reviewedId, rating, comment, escrowId } = req.body;
    
    // Verify transaction exists between users
    const escrow = await client.query(
      `SELECT * FROM escrows WHERE id = $1 AND status = 'completed'`,
      [escrowId]
    );
    
    if (escrow.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No completed transaction found' });
    }
    
    const escrowData = escrow.rows[0];
    if (escrowData.buyer_id !== req.user.id && escrowData.seller_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not authorized to review' });
    }
    
    // Check if already reviewed
    const existing = await client.query(
      `SELECT * FROM reviews WHERE escrow_id = $1 AND reviewer_id = $2`,
      [escrowId, req.user.id]
    );
    
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Already reviewed this transaction' });
    }
    
    // Insert review
    const result = await client.query(
      `INSERT INTO reviews (reviewer_id, reviewed_id, rating, comment, escrow_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, reviewedId, rating, comment, escrowId]
    );
    
    // Update trust score
    await client.query(
      `UPDATE users SET trust_score = (
         SELECT COALESCE(AVG(rating), 0) * 20 FROM reviews WHERE reviewed_id = $1
       ) WHERE id = $1`,
      [reviewedId]
    );
    
    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
