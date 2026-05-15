const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const db = require('../config/database');
const { io } = require('../server');

// Get user conversations
router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT DISTINCT ON (CASE WHEN recipient_id = $1 THEN sender_id ELSE recipient_id END)
         cm.id, cm.sender_id, cm.recipient_id, cm.message, cm.created_at,
         u.username as other_user
       FROM chat_messages cm
       JOIN users u ON (cm.sender_id = $1 AND u.id = cm.recipient_id) 
                  OR (cm.recipient_id = $1 AND u.id = cm.sender_id)
       WHERE cm.sender_id = $1 OR cm.recipient_id = $1
       ORDER BY CASE WHEN recipient_id = $1 THEN sender_id ELSE recipient_id END, cm.created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a conversation
router.get('/messages/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await db.query(
      `SELECT * FROM chat_messages
       WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1)
       ORDER BY created_at ASC`,
      [req.user.id, userId]
    );
    
    // Mark as read
    await db.query(
      `UPDATE chat_messages SET read = true WHERE recipient_id = $1 AND sender_id = $2 AND read = false`,
      [req.user.id, userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send message (also available via Socket.IO)
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { recipientId, message, messageType = 'text' } = req.body;
    
    const result = await db.query(
      `INSERT INTO chat_messages (sender_id, recipient_id, message, message_type)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, recipientId, message, messageType]
    );
    
    // Emit via Socket.IO
    io.to(`user_${recipientId}`).emit('message', result.rows[0]);
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get escrow room messages
router.get('/escrow/:escrowId', authMiddleware, async (req, res) => {
  try {
    const { escrowId } = req.params;
    
    // Verify user is part of escrow
    const escrow = await db.query(`SELECT * FROM escrows WHERE id = $1`, [escrowId]);
    if (escrow.rows.length === 0 || 
        (escrow.rows[0].buyer_id !== req.user.id && escrow.rows[0].seller_id !== req.user.id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const result = await db.query(
      `SELECT cm.*, u.username as sender_name
       FROM chat_messages cm
       JOIN users u ON cm.sender_id = u.id
       WHERE cm.escrow_id = $1
       ORDER BY cm.created_at ASC`,
      [escrowId]
    );
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
