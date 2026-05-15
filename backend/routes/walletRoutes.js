const express = require('express');
const router = express.Router();
const { authMiddleware, roleMiddleware } = require('../middleware/auth');
const db = require('../config/database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Add funds to wallet
router.post('/deposit', authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const { amount, currency = 'USD', paymentMethodId } = req.body;
    const userId = req.user.id;
    
    // Create Stripe payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      payment_method: paymentMethodId,
      confirm: true,
      return_url: `${process.env.FRONTEND_URL}/wallet/success`
    });
    
    // Record transaction
    const txResult = await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, currency, status, payment_intent_id)
       VALUES ($1, 'deposit', $2, $3, 'pending', $4) RETURNING *`,
      [userId, amount, currency, paymentIntent.id]
    );
    
    await client.query('COMMIT');
    
    res.json({ clientSecret: paymentIntent.client_secret, transaction: txResult.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Withdraw funds
router.post('/withdraw', authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const { amount, bankAccountId } = req.body;
    const userId = req.user.id;
    
    // Check balance
    const wallet = await client.query(`SELECT * FROM wallets WHERE user_id = $1`, [userId]);
    if (wallet.rows[0].balance < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Deduct from wallet
    await client.query(`UPDATE wallets SET balance = balance - $1 WHERE user_id = $2`, [amount, userId]);
    
    // Record withdrawal
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, currency, status)
       VALUES ($1, 'withdrawal', $2, 'USD', 'processing')`,
      [userId, amount]
    );
    
    // In production: initiate Stripe payout here
    
    await client.query('COMMIT');
    res.json({ success: true, message: 'Withdrawal initiated' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// Get wallet balance and history
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    
    const transactions = await db.query(
      `SELECT * FROM wallet_transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [req.user.id, parseInt(limit), parseInt(offset)]
    );
    
    const wallet = await db.query(`SELECT * FROM wallets WHERE user_id = $1`, [req.user.id]);
    
    res.json({
      balance: wallet.rows[0]?.balance || 0,
      transactions: transactions.rows
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transfer funds internally
router.post('/transfer', authMiddleware, async (req, res) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    
    const { recipientEmail, amount } = req.body;
    const senderId = req.user.id;
    
    // Get recipient
    const recipient = await client.query(`SELECT id FROM users WHERE email = $1`, [recipientEmail]);
    if (recipient.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    
    const recipientId = recipient.rows[0].id;
    
    // Check sender balance
    const senderWallet = await client.query(`SELECT * FROM wallets WHERE user_id = $1`, [senderId]);
    if (senderWallet.rows[0].balance < amount) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Insufficient balance' });
    }
    
    // Transfer
    await client.query(`UPDATE wallets SET balance = balance - $1 WHERE user_id = $2`, [amount, senderId]);
    await client.query(`UPDATE wallets SET balance = balance + $1 WHERE user_id = $2`, [amount, recipientId]);
    
    // Record transactions
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, currency, status, related_user_id)
       VALUES ($1, 'transfer_out', $2, 'USD', 'completed', $3)`,
      [senderId, amount, recipientId]
    );
    
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, currency, status, related_user_id)
       VALUES ($1, 'transfer_in', $2, 'USD', 'completed', $3)`,
      [recipientId, amount, senderId]
    );
    
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
