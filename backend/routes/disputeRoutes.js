const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const db = require('../config/database');

// Get all disputes (Admin/Moderator/Arbitrator)
router.get('/', authMiddleware, roleMiddleware('admin', 'moderator', 'arbitrator'), async (req, res) => {
  try {
    const { status, page = 1 } = req.query;
    const limit = 20;
    const offset = (page - 1) * limit;
    
    let query = `SELECT d.*, u.username as creator, s.username as seller 
                 FROM disputes d 
                 JOIN users u ON d.creator_id = u.id 
                 JOIN users s ON d.seller_id = s.id`;
    
    const params = [];
    if (status) {
      query += ` WHERE d.status = $${params.length + 1}`;
      params.push(status);
    }
    
    query += ` ORDER BY d.created_at DESC LIMIT ${limit} OFFSET ${offset}`;
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Open new dispute
router.post('/escrow/:escrowId', authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const { escrowId } = req.params;
    const { reason, description } = req.body;
    const userId = req.user.id;
    
    const escrowCheck = await client.query(
      `SELECT * FROM escrows WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
      [escrowId, userId]
    );
    
    if (escrowCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const escrow = escrowCheck.rows[0];
    
    const disputeResult = await client.query(
      `INSERT INTO disputes (escrow_id, creator_id, seller_id, reason, description, status)
       VALUES ($1, $2, $3, $4, $5, 'open') RETURNING *`,
      [escrowId, userId, escrow.seller_id, reason, description]
    );
    
    await client.query(`UPDATE escrows SET status = 'disputed' WHERE id = $1`, [escrowId]);
    
    await client.query('COMMIT');
    res.json(disputeResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Submit evidence
router.post('/:disputeId/evidence', authMiddleware, async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { description, fileUrl, fileType } = req.body;
    
    const result = await db.query(
      `INSERT INTO evidence (dispute_id, submitted_by, description, file_url, file_type)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [disputeId, req.user.id, description, fileUrl, fileType]
    );
    
    await db.query(`UPDATE disputes SET status = 'awaiting_evidence' WHERE id = $1`, [disputeId]);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Arbitrator decision
router.post('/:disputeId/decision', authMiddleware, roleMiddleware('arbitrator'), async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const { disputeId } = req.params;
    const { decision, splitPercentage, reasoning } = req.body;
    
    const dispute = await client.query(`SELECT * FROM disputes WHERE id = $1`, [disputeId]);
    if (dispute.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Dispute not found' });
    }
    
    const escrowId = dispute.rows[0].escrow_id;
    const escrow = await client.query(`SELECT * FROM escrows WHERE id = $1`, [escrowId]);
    const amount = parseFloat(escrow.rows[0].amount);
    
    let buyerAmount = 0, sellerAmount = 0;
    
    if (decision === 'buyer') buyerAmount = amount;
    else if (decision === 'seller') sellerAmount = amount;
    else if (decision === 'split') {
      buyerAmount = amount * (splitPercentage / 100);
      sellerAmount = amount - buyerAmount;
    }
    
    await client.query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [buyerAmount, escrow.rows[0].buyer_id]);
    if (sellerAmount > 0) {
      await client.query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [sellerAmount, escrow.rows[0].seller_id]);
    }
    
    await client.query(`UPDATE disputes SET status = 'resolved', resolution = $1, arbitrator_id = $2 WHERE id = $3`, [decision, req.user.id, disputeId]);
    await client.query(`UPDATE escrows SET status = 'completed' WHERE id = $1`, [escrowId]);
    
    await client.query('COMMIT');
    res.json({ success: true, buyerAmount, sellerAmount });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
