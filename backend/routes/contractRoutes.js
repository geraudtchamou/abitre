const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const db = require('../config/database');

// Get user contracts
router.get('/', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.*, u.username as other_party 
       FROM contracts c
       JOIN users u ON (c.buyer_id = $1 AND u.id = c.seller_id) OR (c.seller_id = $1 AND u.id = c.buyer_id)
       WHERE c.buyer_id = $1 OR c.seller_id = $1
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create contract
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { sellerId, title, description, amount, milestones, terms } = req.body;
    
    const result = await db.query(
      `INSERT INTO contracts (buyer_id, seller_id, title, description, amount, milestones, terms, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'draft') RETURNING *`,
      [req.user.id, sellerId, title, description, amount, JSON.stringify(milestones), JSON.stringify(terms)]
    );
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Sign contract
router.post('/:id/sign', authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const contract = await client.query(`SELECT * FROM contracts WHERE id = $1`, [id]);
    
    if (contract.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    const isBuyer = contract.rows[0].buyer_id === req.user.id;
    const isSeller = contract.rows[0].seller_id === req.user.id;
    
    if (!isBuyer && !isSeller) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const signatureField = isBuyer ? 'buyer_signed' : 'seller_signed';
    await client.query(
      `UPDATE contracts SET ${signatureField} = true, signed_at = NOW() WHERE id = $1`,
      [id]
    );
    
    // Check if both signed
    const updated = await client.query(`SELECT * FROM contracts WHERE id = $1`, [id]);
    if (updated.rows[0].buyer_signed && updated.rows[0].seller_signed) {
      await client.query(`UPDATE contracts SET status = 'active' WHERE id = $1`, [id]);
      
      // Create linked escrow
      await client.query(
        `INSERT INTO escrows (buyer_id, seller_id, amount, contract_id, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [updated.rows[0].buyer_id, updated.rows[0].seller_id, updated.rows[0].amount, id]
      );
    }
    
    await client.query('COMMIT');
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get contract templates
router.get('/templates', authMiddleware, async (req, res) => {
  try {
    const templates = [
      { id: 1, name: 'Freelance Agreement', type: 'freelance' },
      { id: 2, name: 'Service Agreement', type: 'service' },
      { id: 3, name: 'Sales Contract', type: 'sales' }
    ];
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
