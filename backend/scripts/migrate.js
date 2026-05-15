const { query } = require('../config/database');

const createTables = async () => {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20),
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'moderator', 'arbitrator', 'admin')),
      status VARCHAR(20) DEFAULT 'active',
      trust_score INTEGER DEFAULT 0,
      bio TEXT,
      avatar_url VARCHAR(500),
      two_factor_enabled BOOLEAN DEFAULT FALSE,
      two_factor_secret VARCHAR(100),
      suspension_reason TEXT,
      last_login TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS wallets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      balance DECIMAL(15,2) DEFAULT 0.00,
      currency VARCHAR(10) DEFAULT 'USD',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, currency)
    )`,

    `CREATE TABLE IF NOT EXISTS escrows (
      id SERIAL PRIMARY KEY,
      buyer_id INTEGER REFERENCES users(id),
      seller_id INTEGER REFERENCES users(id),
      amount DECIMAL(15,2) NOT NULL,
      fee_amount DECIMAL(15,2) DEFAULT 0.00,
      currency VARCHAR(10) DEFAULT 'USD',
      description TEXT,
      contract_id INTEGER,
      status VARCHAR(20) DEFAULT 'draft',
      funded_at TIMESTAMP,
      released_at TIMESTAMP,
      cancelled_reason TEXT,
      frozen_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS milestones (
      id SERIAL PRIMARY KEY,
      escrow_id INTEGER REFERENCES escrows(id) ON DELETE CASCADE,
      milestone_number INTEGER NOT NULL,
      description TEXT,
      amount DECIMAL(15,2) NOT NULL,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS contracts (
      id SERIAL PRIMARY KEY,
      buyer_id INTEGER REFERENCES users(id),
      seller_id INTEGER REFERENCES users(id),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      amount DECIMAL(15,2),
      milestones JSONB,
      terms JSONB,
      status VARCHAR(20) DEFAULT 'draft',
      buyer_signed BOOLEAN DEFAULT FALSE,
      seller_signed BOOLEAN DEFAULT FALSE,
      signed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS disputes (
      id SERIAL PRIMARY KEY,
      escrow_id INTEGER REFERENCES escrows(id),
      creator_id INTEGER REFERENCES users(id),
      seller_id INTEGER REFERENCES users(id),
      arbitrator_id INTEGER REFERENCES users(id),
      reason VARCHAR(255),
      description TEXT,
      status VARCHAR(30) DEFAULT 'open',
      resolution VARCHAR(50),
      reasoning TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS evidence (
      id SERIAL PRIMARY KEY,
      dispute_id INTEGER REFERENCES disputes(id) ON DELETE CASCADE,
      submitted_by INTEGER REFERENCES users(id),
      description TEXT,
      file_url VARCHAR(500),
      file_type VARCHAR(50),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS wallet_transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id),
      escrow_id INTEGER REFERENCES escrows(id),
      type VARCHAR(30),
      amount DECIMAL(15,2) NOT NULL,
      currency VARCHAR(10) DEFAULT 'USD',
      status VARCHAR(20) DEFAULT 'pending',
      payment_intent_id VARCHAR(255),
      related_user_id INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS fees (
      id SERIAL PRIMARY KEY,
      escrow_id INTEGER REFERENCES escrows(id),
      amount DECIMAL(15,2) NOT NULL,
      type VARCHAR(50),
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS fee_config (
      id SERIAL PRIMARY KEY,
      escrow_fee_percent DECIMAL(5,2) DEFAULT 2.5,
      arbitration_fee DECIMAL(10,2) DEFAULT 50.00,
      withdrawal_fee DECIMAL(10,2) DEFAULT 5.00,
      updated_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS chat_messages (
      id SERIAL PRIMARY KEY,
      sender_id INTEGER REFERENCES users(id),
      recipient_id INTEGER REFERENCES users(id),
      escrow_id INTEGER REFERENCES escrows(id),
      message TEXT NOT NULL,
      message_type VARCHAR(20) DEFAULT 'text',
      file_url VARCHAR(500),
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(50),
      title VARCHAR(255),
      message TEXT,
      data JSONB,
      read BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      reviewer_id INTEGER REFERENCES users(id),
      reviewed_id INTEGER REFERENCES users(id),
      escrow_id INTEGER REFERENCES escrows(id),
      rating INTEGER CHECK (rating >= 1 AND rating <= 5),
      comment TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(reviewer_id, escrow_id)
    )`,

    `CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      device_info VARCHAR(255),
      ip_address VARCHAR(45),
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      actor_id INTEGER REFERENCES users(id),
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50),
      entity_id INTEGER,
      details JSONB,
      ip_address VARCHAR(45),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS fraud_reports (
      id SERIAL PRIMARY KEY,
      entity_id INTEGER NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      risk_score DECIMAL(3,2),
      risk_level VARCHAR(20),
      flags JSONB,
      reasoning TEXT,
      status VARCHAR(20) DEFAULT 'pending_review',
      reviewed_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`,

    `CREATE TABLE IF NOT EXISTS otp_codes (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      code VARCHAR(6) NOT NULL,
      type VARCHAR(20),
      expires_at TIMESTAMP NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  ];

  const indexes = [
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
    `CREATE INDEX IF NOT EXISTS idx_escrows_buyer ON escrows(buyer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_escrows_seller ON escrows(seller_id)`,
    `CREATE INDEX IF NOT EXISTS idx_escrows_status ON escrows(status)`,
    `CREATE INDEX IF NOT EXISTS idx_wallet_tx_user ON wallet_transactions(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_messages(sender_id)`,
    `CREATE INDEX IF NOT EXISTS idx_chat_recipient ON chat_messages(recipient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at)`
  ];

  try {
    console.log('Creating database tables...');
    
    for (const table of tables) {
      await query(table);
    }
    
    console.log('✓ Tables created successfully');
    
    console.log('Creating indexes...');
    
    for (const index of indexes) {
      await query(index);
    }
    
    console.log('✓ Indexes created successfully');
    
    await query(`INSERT INTO fee_config (escrow_fee_percent, arbitration_fee, withdrawal_fee) 
                 VALUES (2.5, 50.00, 5.00) ON CONFLICT DO NOTHING`);
    
    console.log('✓ Default configuration inserted');
    console.log('Database migration completed successfully!');
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
};

if (require.main === module) {
  createTables()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { createTables };
