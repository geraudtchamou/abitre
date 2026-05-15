const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
const authRoutes = require('./routes/authRoutes');
const escrowRoutes = require('./routes/escrowRoutes');
const walletRoutes = require('./routes/walletRoutes');
const disputeRoutes = require('./routes/disputeRoutes');
const contractRoutes = require('./routes/contractRoutes');
const chatRoutes = require('./routes/chatRoutes');
const adminRoutes = require('./routes/adminRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const userRoutes = require('./routes/userRoutes');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/escrows', escrowRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/disputes', disputeRoutes);
app.use('/api/contracts', contractRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO for real-time communication
const jwt = require('jsonwebtoken');

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Authenticate socket connection
  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.join(`user_${decoded.id}`);
      socket.emit('authenticated', { success: true });
      console.log(`User ${decoded.id} authenticated on socket ${socket.id}`);
    } catch (error) {
      socket.emit('authentication_error', { error: 'Invalid token' });
    }
  });

  // Join escrow room
  socket.on('join_escrow', (escrowId) => {
    socket.join(`escrow_${escrowId}`);
    console.log(`User ${socket.userId} joined escrow room ${escrowId}`);
  });

  // Send message
  socket.on('send_message', async (data) => {
    const { recipientId, message, escrowId } = data;
    
    // Save to database (import db here to avoid circular dependency)
    const db = require('./config/database');
    try {
      const result = await db.query(
        `INSERT INTO chat_messages (sender_id, recipient_id, message, escrow_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [socket.userId, recipientId, message, escrowId || null]
      );
      
      // Emit to recipient
      if (recipientId) {
        io.to(`user_${recipientId}`).emit('message', result.rows[0]);
      }
      
      // Emit to escrow room if applicable
      if (escrowId) {
        io.to(`escrow_${escrowId}`).emit('message', result.rows[0]);
      }
      
      socket.emit('message_sent', result.rows[0]);
    } catch (error) {
      console.error('Socket message error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing', ({ recipientId, isTyping }) => {
    io.to(`user_${recipientId}`).emit('user_typing', { userId: socket.userId, isTyping });
  });

  // Dispute updates
  socket.on('dispute_update', (data) => {
    const { disputeId, type } = data;
    io.to(`dispute_${disputeId}`).emit('dispute_event', data);
  });

  // Join dispute room
  socket.on('join_dispute', (disputeId) => {
    socket.join(`dispute_${disputeId}`);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  
  // Initialize database connection
  const db = require('./config/database');
  db.testConnection();
});

module.exports = { app, io };
