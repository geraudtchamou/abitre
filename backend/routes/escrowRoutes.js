const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const db = require('../config/database');

// Get all escrows (with filters)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `SELECT e.*, 
                  b.username as buyer_name, s.username as seller_name,
                  c.title as contract_title
                 FROM escrows e
                 JOIN users b ON e.buyer_id = b.id
                 JOIN users s ON e.seller_id = s.id
                 LEFT JOIN contracts c ON e.contract_id = c.id
                 WHERE e.buyer_id = $1 OR e.seller_id = $1`;
    
    const params = [req.user.id];
    
    if (status) {
      params.push(status);
      query += ` AND e.status = $${params.length}`;
    }
    
    query += ` ORDER BY e.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single escrow
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await db.query(
      `SELECT e.*, b.username as buyer_name, s.username as seller_name,
              c.title as contract_title, c.description as contract_description
       FROM escrows e
       JOIN users b ON e.buyer_id = b.id
       JOIN users s ON e.seller_id = s.id
       LEFT JOIN contracts c ON e.contract_id = c.id
       WHERE e.id = $1`,
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Escrow not found' });
    }
    
    const escrow = result.rows[0];
    
    // Verify authorization
    if (escrow.buyer_id !== req.user.id && escrow.seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    // Get milestones
    const milestones = await db.query(
      `SELECT * FROM milestones WHERE escrow_id = $1 ORDER BY milestone_number`,
      [id]
    );
    
    res.json({ ...escrow, milestones: milestones.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create escrow
router.post('/', authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const { sellerId, amount, description, milestones, contractId } = req.body;
    
    // Calculate fee
    const feeConfig = await client.query(`SELECT * FROM fee_config ORDER BY created_at DESC LIMIT 1`);
    const feePercent = feeConfig.rows[0]?.escrow_fee_percent || 2.5;
    const feeAmount = (amount * feePercent) / 100;
    
    // Create escrow
    const escrowResult = await client.query(
      `INSERT INTO escrows (buyer_id, seller_id, amount, fee_amount, description, contract_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
      [req.user.id, sellerId, amount, feeAmount, description, contractId || null]
    );
    
    // Create milestones if provided
    if (milestones && milestones.length > 0) {
      for (let i = 0; i < milestones.length; i++) {
        await client.query(
          `INSERT INTO milestones (escrow_id, milestone_number, description, amount, status)
           VALUES ($1, $2, $3, $4, 'pending')`,
          [escrowResult.rows[0].id, i + 1, milestones[i].description, milestones[i].amount]
        );
      }
    }
    
    // Record fee
    await client.query(
      `INSERT INTO fees (escrow_id, amount, type, description)
       VALUES ($1, $2, 'escrow_fee', 'Platform fee for escrow ${escrowResult.rows[0].id})`,
      [escrowResult.rows[0].id, feeAmount]
    );
    
    await client.query('COMMIT');
    res.json(escrowResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Fund escrow
router.post('/:id/fund', authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const escrow = await client.query(`SELECT * FROM escrows WHERE id = $1`, [id]);
    
    if (escrow.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Escrow not found' });
    }
    
    if (escrow.rows[0].buyer_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only buyer can fund' });
    }
    
    // Check wallet balance
    const wallet = await client.query(`SELECT * FROM wallets WHERE user_id = $1`, [req.user.id]);
    if (wallet.rows[0].balance < escrow.rows[0].amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient funds' });
    }
    
    // Deduct from wallet
    await client.query(`UPDATE wallets SET balance = balance - $1 WHERE user_id = $2`, [escrow.rows[0].amount, req.user.id]);
    
    // Lock funds in transaction record
    await client.query(
      `INSERT INTO wallet_transactions (user_id, escrow_id, type, amount, currency, status)
       VALUES ($1, $2, 'escrow_fund', $3, 'USD', 'locked')`,
      [req.user.id, id, escrow.rows[0].amount]
    );
    
    // Update escrow status
    await client.query(`UPDATE escrows SET status = 'active', funded_at = NOW() WHERE id = $1`, [id]);
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Escrow funded successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Release funds (Seller requests, Buyer confirms)
router.post('/:id/release', authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { milestoneId } = req.body;
    
    const escrow = await client.query(`SELECT * FROM escrows WHERE id = $1`, [id]);
    if (escrow.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Escrow not found' });
    }
    
    // Only buyer can release
    if (escrow.rows[0].buyer_id !== req.user.id) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Only buyer can release funds' });
    }
    
    const amount = milestoneId ? 
      (await client.query(`SELECT amount FROM milestones WHERE id = $1`, [milestoneId])).rows[0]?.amount :
      escrow.rows[0].amount;
    
    // Credit seller
    await client.query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [amount, escrow.rows[0].seller_id]);
    
    // Update transaction status
    await client.query(
      `UPDATE wallet_transactions SET status = 'completed', processed_at = NOW() 
       WHERE escrow_id = $1 AND status = 'locked'`,
      [id]
    );
    
    // Update milestone if applicable
    if (milestoneId) {
      await client.query(`UPDATE milestones SET status = 'completed' WHERE id = $1`, [milestoneId]);
    } else {
      await client.query(`UPDATE escrows SET status = 'completed', released_at = NOW() WHERE id = $1`, [id]);
    }
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Cancel escrow
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { reason } = req.body;
    
    const escrow = await client.query(`SELECT * FROM escrows WHERE id = $1`, [id]);
    if (escrow.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Escrow not found' });
    }
    
    // Only allow cancellation if not completed
    if (['completed', 'refunded'].includes(escrow.rows[0].status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot cancel completed escrow' });
    }
    
    // Refund to buyer if funded
    if (escrow.rows[0].status === 'active') {
      await client.query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [escrow.rows[0].amount, escrow.rows[0].buyer_id]);
      await client.query(`UPDATE wallet_transactions SET status = 'refunded' WHERE escrow_id = $1`, [id]);
    }
    
    await client.query(`UPDATE escrows SET status = 'cancelled', cancelled_reason = $1 WHERE id = $2`, [reason, id]);
    
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

module.exports = router;
