-- TrustEscrow Database Initialization Script
-- PostgreSQL Schema with Advanced Features

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- Enums
CREATE TYPE user_role AS ENUM ('user', 'moderator', 'arbitrator', 'admin');
CREATE TYPE escrow_status AS ENUM ('draft', 'pending', 'active', 'completed', 'disputed', 'refunded', 'cancelled', 'frozen');
CREATE TYPE dispute_status AS ENUM ('open', 'under_review', 'awaiting_evidence', 'arbitration', 'resolved', 'appealed');
CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'transfer', 'escrow_lock', 'escrow_release', 'refund', 'fee');
CREATE TYPE notification_type AS ENUM ('escrow', 'payment', 'dispute', 'message', 'system', 'security');

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    avatar_url TEXT,
    role user_role DEFAULT 'user',
    trust_score DECIMAL(5,2) DEFAULT 0.00,
    is_verified BOOLEAN DEFAULT FALSE,
    is_2fa_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    kyc_status VARCHAR(50) DEFAULT 'pending',
    kyc_documents JSONB,
    country VARCHAR(100),
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    last_login_at TIMESTAMP,
    login_count INTEGER DEFAULT 0,
    failed_login_attempts INTEGER DEFAULT 0,
    is_suspended BOOLEAN DEFAULT FALSE,
    suspension_reason TEXT,
    suspended_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_trust_score ON users(trust_score);
CREATE INDEX idx_users_kyc_status ON users(kyc_status);
CREATE INDEX idx_users_search ON users USING gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || email));

-- Sessions Table
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    refresh_token_hash VARCHAR(255),
    expires_at TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token_hash);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Wallets Table
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    balance_usd DECIMAL(20,8) DEFAULT 0.00000000,
    balance_eur DECIMAL(20,8) DEFAULT 0.00000000,
    balance_gbp DECIMAL(20,8) DEFAULT 0.00000000,
    balance_xaf DECIMAL(20,8) DEFAULT 0.00000000,
    balance_btc DECIMAL(20,8) DEFAULT 0.00000000,
    balance_eth DECIMAL(20,8) DEFAULT 0.00000000,
    balance_usdt DECIMAL(20,8) DEFAULT 0.00000000,
    locked_balance JSONB DEFAULT '{}',
    is_frozen BOOLEAN DEFAULT FALSE,
    freeze_reason TEXT,
    frozen_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_balances ON wallets USING gin(lockeD_balance);

-- Wallet Transactions
CREATE TABLE wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
    type transaction_type NOT NULL,
    currency VARCHAR(10) NOT NULL,
    amount DECIMAL(20,8) NOT NULL,
    balance_before DECIMAL(20,8),
    balance_after DECIMAL(20,8),
    reference_id UUID,
    reference_type VARCHAR(50),
    description TEXT,
    metadata JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wallet_tx_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX idx_wallet_tx_type ON wallet_transactions(type);
CREATE INDEX idx_wallet_tx_status ON wallet_transactions(status);
CREATE INDEX idx_wallet_tx_created ON wallet_transactions(created_at);
CREATE INDEX idx_wallet_tx_reference ON wallet_transactions(reference_id, reference_type);

-- Escrows Table
CREATE TABLE escrows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    buyer_id UUID REFERENCES users(id) ON DELETE CASCADE,
    seller_id UUID REFERENCES users(id) ON DELETE CASCADE,
    arbitrator_id UUID REFERENCES users(id),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    total_amount DECIMAL(20,8) NOT NULL,
    funded_amount DECIMAL(20,8) DEFAULT 0.00000000,
    released_amount DECIMAL(20,8) DEFAULT 0.00000000,
    refunded_amount DECIMAL(20,8) DEFAULT 0.00000000,
    fee_amount DECIMAL(20,8) DEFAULT 0.00,
    status escrow_status DEFAULT 'draft',
    contract_id UUID,
    milestone_based BOOLEAN DEFAULT FALSE,
    auto_release_days INTEGER,
    requires_arbitration BOOLEAN DEFAULT FALSE,
    metadata JSONB,
    terms_conditions TEXT,
    completed_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    disputed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_escrows_buyer ON escrows(buyer_id);
CREATE INDEX idx_escrows_seller ON escrows(seller_id);
CREATE INDEX idx_escrows_status ON escrows(status);
CREATE INDEX idx_escrows_created ON escrows(created_at);
CREATE INDEX idx_escrows_search ON escrows USING gin(to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Milestones
CREATE TABLE milestones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_id UUID REFERENCES escrows(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    amount DECIMAL(20,8) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    due_date TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending',
    deliverables JSONB,
    approved_at TIMESTAMP,
    rejected_at TIMESTAMP,
    rejection_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_milestones_escrow ON milestones(escrow_id);
CREATE INDEX idx_milestones_status ON milestones(status);

-- Disputes
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_id UUID REFERENCES escrows(id) ON DELETE CASCADE,
    opened_by UUID REFERENCES users(id),
    assigned_arbitrator UUID REFERENCES users(id),
    status dispute_status DEFAULT 'open',
    reason TEXT NOT NULL,
    description TEXT,
    resolution TEXT,
    decided_amount DECIMAL(20,8),
    buyer_refund_amount DECIMAL(20,8),
    seller_release_amount DECIMAL(20,8),
    arbitration_fee DECIMAL(20,8),
    evidence JSONB,
    hearing_scheduled_at TIMESTAMP,
    resolved_at TIMESTAMP,
    appealed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_disputes_escrow ON disputes(escrow_id);
CREATE INDEX idx_disputes_status ON disputes(status);
CREATE INDEX idx_disputes_arbitrator ON disputes(assigned_arbitrator);
CREATE INDEX idx_disputes_created ON disputes(created_at);

-- Evidence
CREATE TABLE evidence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dispute_id UUID REFERENCES disputes(id) ON DELETE CASCADE,
    submitted_by UUID REFERENCES users(id),
    file_url TEXT NOT NULL,
    file_type VARCHAR(50),
    file_size BIGINT,
    description TEXT,
    is_confidential BOOLEAN DEFAULT FALSE,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_evidence_dispute ON evidence(dispute_id);
CREATE INDEX idx_evidence_submitted_by ON evidence(submitted_by);

-- Contracts
CREATE TABLE contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    template_type VARCHAR(100),
    parties JSONB NOT NULL,
    terms JSONB NOT NULL,
    clauses JSONB,
    version INTEGER DEFAULT 1,
    parent_contract_id UUID,
    status VARCHAR(50) DEFAULT 'draft',
    signed_by JSONB,
    signed_at TIMESTAMP,
    pdf_url TEXT,
    ai_generated BOOLEAN DEFAULT FALSE,
    language VARCHAR(10) DEFAULT 'en',
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_contracts_status ON contracts(status);
CREATE INDEX idx_contracts_parties ON contracts USING gin(parties);

-- Chat Messages
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL,
    room_type VARCHAR(50) NOT NULL,
    sender_id UUID REFERENCES users(id),
    content TEXT,
    message_type VARCHAR(50) DEFAULT 'text',
    attachments JSONB,
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP,
    read_by JSONB DEFAULT '[]',
    deleted_by JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_room ON chat_messages(room_id, room_type);
CREATE INDEX idx_chat_sender ON chat_messages(sender_id);
CREATE INDEX idx_chat_created ON chat_messages(created_at);
CREATE INDEX idx_chat_content ON chat_messages USING gin(to_tsvector('english', COALESCE(content, '')));

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type notification_type NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    action_url TEXT,
    priority VARCHAR(20) DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);

-- Reviews
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    escrow_id UUID REFERENCES escrows(id),
    reviewer_id UUID REFERENCES users(id),
    reviewee_id UUID REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    categories JSONB,
    is_anonymous BOOLEAN DEFAULT FALSE,
    response TEXT,
    responded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id);
CREATE INDEX idx_reviews_escrow ON reviews(escrow_id);
CREATE INDEX idx_reviews_rating ON reviews(rating);

-- Fraud Reports
CREATE TABLE fraud_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reported_user_id UUID REFERENCES users(id),
    reporter_id UUID REFERENCES users(id),
    escrow_id UUID REFERENCES escrows(id),
    report_type VARCHAR(100),
    description TEXT NOT NULL,
    evidence JSONB,
    ai_risk_score DECIMAL(5,2),
    status VARCHAR(50) DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    resolution TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_fraud_reported_user ON fraud_reports(reported_user_id);
CREATE INDEX idx_fraud_status ON fraud_reports(status);
CREATE INDEX idx_fraud_ai_score ON fraud_reports(ai_risk_score);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_created ON audit_logs(created_at);

-- Fee Configurations
CREATE TABLE fee_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    fee_type VARCHAR(50) NOT NULL,
    calculation_method VARCHAR(50) NOT NULL,
    percentage DECIMAL(5,2),
    flat_amount DECIMAL(20,8),
    min_amount DECIMAL(20,8),
    max_amount DECIMAL(20,8),
    currency VARCHAR(10),
    applies_to JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    effective_from TIMESTAMP,
    effective_to TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Settings
CREATE TABLE system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    updated_by UUID REFERENCES users(id),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Materialized Views for Analytics
CREATE MATERIALIZED VIEW mv_user_analytics AS
SELECT 
    u.id,
    u.email,
    u.trust_score,
    COUNT(DISTINCT e.id) as total_escrows,
    COUNT(DISTINCT CASE WHEN e.status = 'completed' THEN e.id END) as completed_escrows,
    COUNT(DISTINCT CASE WHEN e.status = 'disputed' THEN e.id END) as disputed_escrows,
    SUM(CASE WHEN e.status = 'completed' THEN e.total_amount ELSE 0 END) as total_volume,
    AVG(CASE WHEN r.rating IS NOT NULL THEN r.rating END) as avg_rating,
    COUNT(DISTINCT r.id) as total_reviews
FROM users u
LEFT JOIN escrows e ON (u.id = e.buyer_id OR u.id = e.seller_id)
LEFT JOIN reviews r ON (u.id = r.reviewee_id)
GROUP BY u.id;

CREATE UNIQUE INDEX idx_mv_user_analytics ON mv_user_analytics(id);

CREATE MATERIALIZED VIEW mv_revenue_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as transaction_count,
    SUM(fee_amount) as total_fees,
    SUM(total_amount) as total_volume,
    currency
FROM escrows
WHERE status = 'completed'
GROUP BY DATE_TRUNC('day', created_at), currency
ORDER BY date DESC;

CREATE UNIQUE INDEX idx_mv_revenue_analytics ON mv_revenue_analytics(date, currency);

-- Functions and Triggers

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_escrows_updated_at BEFORE UPDATE ON escrows
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_disputes_updated_at BEFORE UPDATE ON disputes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit Log Trigger Function
CREATE OR REPLACE FUNCTION log_audit_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (action, resource_type, resource_id, new_values)
        VALUES ('INSERT', TG_TABLE_NAME, NEW.id, to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (action, resource_type, resource_id, old_values, new_values)
        VALUES ('UPDATE', TG_TABLE_NAME, NEW.id, to_jsonb(OLD), to_jsonb(NEW));
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO audit_logs (action, resource_type, resource_id, old_values)
        VALUES ('DELETE', TG_TABLE_NAME, OLD.id, to_jsonb(OLD));
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply audit logging to critical tables
CREATE TRIGGER audit_escrows_changes AFTER INSERT OR UPDATE OR DELETE ON escrows
    FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

CREATE TRIGGER audit_disputes_changes AFTER INSERT OR UPDATE OR DELETE ON disputes
    FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

CREATE TRIGGER audit_wallet_transactions_changes AFTER INSERT OR UPDATE OR DELETE ON wallet_transactions
    FOR EACH ROW EXECUTE FUNCTION log_audit_changes();

-- Refresh materialized views function
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_analytics;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_revenue_analytics;
END;
$$ LANGUAGE plpgsql;

-- Insert default settings
INSERT INTO system_settings (key, value, description, is_public) VALUES
('platform_name', '{"en": "TrustEscrow"}', 'Platform display name', true),
('escrow_fee_percentage', '{"value": 2.5}', 'Default escrow fee percentage', false),
('arbitration_fee_flat', '{"value": 100, "currency": "USD"}', 'Flat arbitration fee', false),
('min_escrow_amount', '{"USD": 10, "EUR": 10, "GBP": 10}', 'Minimum escrow amount by currency', true),
('max_escrow_amount', '{"USD": 1000000, "EUR": 900000, "GBP": 800000}', 'Maximum escrow amount by currency', true),
('auto_release_days', '{"value": 14}', 'Days before auto-release', true),
('kyc_required_threshold', '{"value": 1000, "currency": "USD"}', 'KYC required above this amount', false),
('maintenance_mode', '{"enabled": false}', 'System maintenance mode', true);

-- Insert default fee configurations
INSERT INTO fee_configurations (name, fee_type, calculation_method, percentage, min_amount, max_amount, currency, applies_to, is_active) VALUES
('Standard Escrow Fee', 'escrow', 'percentage', 2.5, 1.00, 500.00, 'USD', '{"all": true}', true),
('Premium Escrow Fee', 'escrow', 'percentage', 1.5, 5.00, 1000.00, 'USD', '{"premium_users": true}', true),
('Arbitration Fee', 'arbitration', 'flat', NULL, 100.00, 100.00, 'USD', '{"all": true}', true),
('Withdrawal Fee', 'withdrawal', 'percentage', 0.5, 0.50, 50.00, 'USD', '{"all": true}', true),
('Currency Conversion', 'conversion', 'percentage', 1.0, NULL, NULL, 'USD', '{"all": true}', true);

COMMENT ON TABLE users IS 'User accounts with roles, verification, and trust scores';
COMMENT ON TABLE wallets IS 'Multi-currency wallet balances';
COMMENT ON TABLE escrows IS 'Escrow transactions with milestone support';
COMMENT ON TABLE disputes IS 'Dispute cases for arbitration';
COMMENT ON TABLE contracts IS 'Smart contracts with versioning';
COMMENT ON TABLE chat_messages IS 'Real-time communication messages';
COMMENT ON TABLE fraud_reports IS 'AI-powered fraud detection reports';
COMMENT ON TABLE audit_logs IS 'Comprehensive audit trail for compliance';
