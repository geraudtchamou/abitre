-- Migration: Create transactions table for Rouleaux Ledger
-- This creates an immutable, append-only ledger table

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hash VARCHAR(64) UNIQUE NOT NULL,
    previous_hash VARCHAR(64) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    counterparty_id VARCHAR(255),
    transaction_type VARCHAR(100) NOT NULL,
    amount BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB,
    signature TEXT NOT NULL,
    nonce BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    block_height BIGINT NOT NULL DEFAULT 0,
    is_verified BOOLEAN NOT NULL DEFAULT TRUE
);

-- Create indexes for efficient querying
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_counterparty_id ON transactions(counterparty_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_hash ON transactions(hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_previous_hash ON transactions(previous_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_block_height ON transactions(block_height);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_currency ON transactions(currency);

-- Create composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_created 
ON transactions(user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_type_created 
ON transactions(transaction_type, created_at DESC);

-- Create a view for ledger statistics
CREATE OR REPLACE VIEW ledger_stats AS
SELECT 
    COUNT(*) as total_transactions,
    COALESCE(SUM(amount), 0) as total_volume,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT counterparty_id) as unique_counterparties,
    COALESCE(MAX(block_height), 0) as latest_block_height,
    MIN(created_at) as genesis_time,
    MAX(created_at) as latest_transaction_time
FROM transactions;

-- Create a function to verify transaction chain integrity
CREATE OR REPLACE FUNCTION verify_chain_integrity()
RETURNS TABLE (
    is_valid BOOLEAN,
    broken_at_hash VARCHAR,
    error_message TEXT
) AS $$
DECLARE
    prev_hash VARCHAR;
    current_record RECORD;
    expected_hash VARCHAR;
BEGIN
    prev_hash := 'genesis';
    
    FOR current_record IN 
        SELECT * FROM transactions ORDER BY block_height ASC
    LOOP
        -- Verify hash chain
        IF current_record.previous_hash != prev_hash THEN
            RETURN QUERY SELECT 
                FALSE, 
                current_record.hash, 
                format('Chain broken: expected previous_hash %s, got %s', prev_hash, current_record.previous_hash);
            RETURN;
        END IF;
        
        -- Verify transaction hash (this would need to be implemented in Rust or via a trigger)
        -- For now, we just check the chain linkage
        
        prev_hash := current_record.hash;
    END LOOP;
    
    RETURN QUERY SELECT TRUE, NULL::VARCHAR, 'Chain integrity verified'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to prevent updates or deletes (append-only)
CREATE OR REPLACE FUNCTION prevent_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Transactions are immutable. Updates are not allowed.';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Transactions cannot be deleted. This is an append-only ledger.';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Apply the trigger to the transactions table
CREATE TRIGGER trg_prevent_update
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_modification();

CREATE TRIGGER trg_prevent_delete
    BEFORE DELETE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION prevent_modification();

-- Create a materialized view for user transaction summaries (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS user_transaction_summary AS
SELECT 
    user_id,
    COUNT(*) as total_transactions,
    SUM(amount) as total_amount,
    COUNT(DISTINCT currency) as currencies_used,
    MIN(created_at) as first_transaction,
    MAX(created_at) as last_transaction,
    COUNT(DISTINCT transaction_type) as transaction_types
FROM transactions
GROUP BY user_id;

-- Create index on the materialized view
CREATE INDEX IF NOT EXISTS idx_user_summary_user_id ON user_transaction_summary(user_id);

-- Function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_user_summary()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_transaction_summary;
END;
$$ LANGUAGE plpgsql;

-- Insert a genesis transaction if the table is empty
INSERT INTO transactions (hash, previous_hash, user_id, transaction_type, amount, currency, description, signature, block_height, is_verified)
SELECT 
    '0000000000000000000000000000000000000000000000000000000000000000',
    'genesis',
    'system',
    'genesis',
    0,
    'N/A',
    'Genesis block - initialization of Rouleaux Ledger',
    'system_signature',
    0,
    TRUE
WHERE NOT EXISTS (SELECT 1 FROM transactions);
