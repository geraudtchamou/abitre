const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const redis = require('redis');
require('dotenv').config();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Redis client
const redisClient = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.connect().catch(console.error);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(compression());
app.use(morgan('combined'));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.'
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database connection
const db = require('./config/database');

// Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const escrowRoutes = require('./routes/escrow.routes');
const contractRoutes = require('./routes/contract.routes');
const disputeRoutes = require('./routes/dispute.routes');
const walletRoutes = require('./routes/wallet.routes');
const chatRoutes = require('./routes/chat.routes');
const adminRoutes = require('./routes/admin.routes');
const paymentRoutes = require('./routes/payment.routes');

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/escrows', escrowRoutes);
app.use('/api/v1/contracts', contractRoutes);
app.use('/api/v1/disputes', disputeRoutes);
app.use('/api/v1/wallets', walletRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/payments', paymentRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join escrow room
  socket.on('join-escrow', (escrowId) => {
    socket.join(`escrow:${escrowId}`);
    console.log(`User joined escrow room: ${escrowId}`);
  });

  // Join dispute room
  socket.on('join-dispute', (disputeId) => {
    socket.join(`dispute:${disputeId}`);
    console.log(`User joined dispute room: ${disputeId}`);
  });

  // Chat message
  socket.on('send-message', async (data) => {
    const { roomId, message, senderId } = data;
    
    // Save message to database
    try {
      const { ChatMessage } = require('./models');
      await ChatMessage.create({
        roomId,
        senderId,
        content: message.content,
        type: message.type || 'text'
      });
      
      // Broadcast to room
      io.to(roomId).emit('receive-message', {
        ...message,
        senderId,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving chat message:', error);
    }
  });

  // Typing indicator
  socket.on('typing', (data) => {
    socket.to(data.roomId).emit('user-typing', {
      userId: data.userId,
      isTyping: data.isTyping
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// Start server
const PORT = process.env.PORT || 5000;

db.sequelize.authenticate()
  .then(() => {
    console.log('Database connection established successfully.');
    return db.sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
  })
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });
  })
  .catch((err) => {
    console.error('Unable to start server:', err);
    process.exit(1);
  });

module.exports = { app, io, redisClient };
