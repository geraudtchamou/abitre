# TrustEscrow Platform

A modern, scalable, AI-powered escrow and arbitration platform for secure digital transactions.

## Features

- 🔐 Secure escrow transactions with milestone support
- 📝 Smart contracts with digital signatures
- ⚖️ Arbitration and dispute resolution system
- 💬 Real-time chat with Socket.IO
- 💰 Multi-currency wallet system
- 🤖 AI-powered fraud detection
- 📊 Advanced analytics dashboards
- 👥 Role-based access control (User, Moderator, Arbitrator, Admin)
- 📱 Mobile-ready responsive design
- 🔒 Enterprise-grade security

## Tech Stack

### Backend
- Node.js + Express
- PostgreSQL
- Redis
- Socket.IO
- JWT Authentication
- Stripe Integration

### Frontend
- React.js
- Tailwind CSS
- Redux Toolkit
- Recharts
- Framer Motion

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+

### Installation

```bash
# Clone repository
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run database migrations
npm run migrate

# Start server
npm run dev
```

### Environment Variables

```env
# Server
PORT=5000
NODE_ENV=development

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=trustescrow
DB_USER=postgres
DB_PASSWORD=your_password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your_super_secret_key
JWT_EXPIRES_IN=7d

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Frontend URL
FRONTEND_URL=http://localhost:3000

# OpenAI (optional for AI features)
OPENAI_API_KEY=sk-...
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Logout

### Escrows
- `GET /api/escrows` - List user escrows
- `POST /api/escrows` - Create escrow
- `POST /api/escrows/:id/fund` - Fund escrow
- `POST /api/escrows/:id/release` - Release funds
- `POST /api/escrows/:id/cancel` - Cancel escrow

### Wallet
- `GET /api/wallet/history` - Transaction history
- `POST /api/wallet/deposit` - Add funds
- `POST /api/wallet/withdraw` - Withdraw funds
- `POST /api/wallet/transfer` - Internal transfer

### Disputes
- `GET /api/disputes` - List disputes
- `POST /api/disputes/escrow/:id` - Open dispute
- `POST /api/disputes/:id/evidence` - Submit evidence
- `POST /api/disputes/:id/decision` - Arbitrator decision

### Contracts
- `GET /api/contracts` - List contracts
- `POST /api/contracts` - Create contract
- `POST /api/contracts/:id/sign` - Sign contract

### Admin
- `GET /api/admin/stats` - Dashboard stats
- `GET /api/admin/revenue` - Revenue analytics
- `POST /api/admin/users/:id/status` - Manage users
- `POST /api/admin/escrows/:id/freeze` - Freeze escrow

## Database Schema

Key tables:
- `users` - User accounts with roles
- `wallets` - User wallets
- `escrows` - Escrow transactions
- `contracts` - Smart contracts
- `disputes` - Dispute cases
- `evidence` - Dispute evidence
- `chat_messages` - Real-time messages
- `notifications` - User notifications
- `reviews` - User ratings
- `audit_logs` - System audit trail

## Security Features

- JWT authentication with refresh tokens
- Two-factor authentication (2FA)
- Rate limiting via Redis
- SQL injection prevention (parameterized queries)
- XSS protection
- CSRF protection
- Encrypted sensitive data
- Session management
- Device fingerprinting

## Real-Time Features

Socket.IO enables:
- Instant messaging
- Typing indicators
- Live notifications
- Escrow status updates
- Dispute updates
- Online presence

## AI Features

- Fraud risk analysis
- Chat content moderation
- Dispute summarization
- Contract analysis
- Risk prediction

## Running in Production

```bash
# Build for production
npm run build

# Start production server
npm start

# Or use Docker
docker-compose up -d
```

## Monitoring

- Grafana + Prometheus for metrics
- Sentry for error tracking
- ELK Stack for logs

## License

MIT
