//! Data models for Rouleaux Ledger

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use sha2::{Sha256, Digest};
use hex;

/// Represents a transaction in the ledger
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Transaction {
    pub id: Uuid,
    pub hash: String,
    pub previous_hash: String,
    pub user_id: String,
    pub counterparty_id: Option<String>,
    pub transaction_type: String,
    pub amount: i64, // Stored in smallest currency unit (e.g., cents)
    pub currency: String,
    pub description: String,
    pub metadata: Option<serde_json::Value>,
    pub signature: String,
    pub nonce: u64,
    pub created_at: DateTime<Utc>,
    pub block_height: i64,
    pub is_verified: bool,
}

/// Input for creating a new transaction
#[derive(Debug, Deserialize)]
pub struct CreateTransactionRequest {
    pub user_id: String,
    pub counterparty_id: Option<String>,
    pub transaction_type: String,
    pub amount: i64,
    pub currency: String,
    pub description: String,
    #[serde(default)]
    pub metadata: Option<serde_json::Value>,
    pub signature: String,
}

/// Query parameters for searching transactions
#[derive(Debug, Deserialize)]
pub struct TransactionQuery {
    pub user_id: Option<String>,
    pub counterparty_id: Option<String>,
    pub transaction_type: Option<String>,
    pub currency: Option<String>,
    pub start_date: Option<DateTime<Utc>>,
    pub end_date: Option<DateTime<Utc>>,
    pub min_amount: Option<i64>,
    pub max_amount: Option<i64>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

/// Response wrapper for transaction queries
#[derive(Debug, Serialize)]
pub struct TransactionListResponse {
    pub transactions: Vec<Transaction>,
    pub total_count: i64,
    pub has_more: bool,
    pub merkle_root: String,
}

/// Ledger statistics
#[derive(Debug, Serialize)]
pub struct LedgerStats {
    pub total_transactions: i64,
    pub total_volume: i64,
    pub unique_users: i64,
    pub latest_block_height: i64,
    pub latest_transaction_hash: String,
    pub merkle_root: String,
}

impl Transaction {
    /// Generate a cryptographic hash for the transaction
    pub fn generate_hash(
        user_id: &str,
        counterparty_id: &Option<String>,
        transaction_type: &str,
        amount: i64,
        currency: &str,
        description: &str,
        previous_hash: &str,
        nonce: u64,
    ) -> String {
        let mut hasher = Sha256::new();
        
        let data = format!(
            "{}|{:?}|{}|{}|{}|{}|{}|{}",
            user_id, counterparty_id, transaction_type, amount, currency, description, previous_hash, nonce
        );
        
        hasher.update(data.as_bytes());
        hex::encode(hasher.finalize())
    }

    /// Verify the transaction hash
    pub fn verify_hash(&self) -> bool {
        let expected_hash = Self::generate_hash(
            &self.user_id,
            &self.counterparty_id,
            &self.transaction_type,
            self.amount,
            &self.currency,
            &self.description,
            &self.previous_hash,
            self.nonce,
        );
        self.hash == expected_hash
    }
}

/// Merkle tree node for batch verification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerkleNode {
    pub hash: String,
    pub left: Option<Box<MerkleNode>>,
    pub right: Option<Box<MerkleNode>>,
}

impl MerkleNode {
    /// Compute Merkle root from a list of transaction hashes
    pub fn compute_root(hashes: &[String]) -> String {
        if hashes.is_empty() {
            return Self::hash_empty();
        }

        let mut current_level: Vec<String> = hashes.to_vec();

        while current_level.len() > 1 {
            let mut next_level = Vec::new();
            let mut i = 0;

            while i < current_level.len() {
                let left = &current_level[i];
                let right = if i + 1 < current_level.len() {
                    &current_level[i + 1]
                } else {
                    left // Duplicate if odd number
                };

                let mut hasher = Sha256::new();
                hasher.update(left.as_bytes());
                hasher.update(right.as_bytes());
                next_level.push(hex::encode(hasher.finalize()));

                i += 2;
            }

            current_level = next_level;
        }

        current_level.into_iter().next().unwrap()
    }

    fn hash_empty() -> String {
        let mut hasher = Sha256::new();
        hasher.update(b"empty");
        hex::encode(hasher.finalize())
    }
}
