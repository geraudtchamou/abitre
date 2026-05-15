//! Cryptographic utilities for Rouleaux Ledger

use sha2::{Sha256, Digest};
use hex;

/// Compute SHA256 hash of data
pub fn hash_data(data: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hex::encode(hasher.finalize())
}

/// Compute hash of two hashes concatenated (for Merkle trees)
pub fn hash_pair(left: &str, right: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(left.as_bytes());
    hasher.update(right.as_bytes());
    hex::encode(hasher.finalize())
}

/// Verify a signature (placeholder - in production use ed25519 or ECDSA)
pub fn verify_signature(_public_key: &str, _data: &str, _signature: &str) -> bool {
    // In production: implement proper cryptographic signature verification
    // This is a placeholder that always returns true for demo purposes
    true
}

/// Generate a nonce for proof-of-work (optional feature)
pub fn find_valid_nonce(data: &str, difficulty: u32) -> u64 {
    let prefix = "0".repeat(difficulty as usize);
    let mut nonce: u64 = 0;

    loop {
        let hash_input = format!("{}|{}", data, nonce);
        let hash = hash_data(hash_input.as_bytes());
        
        if hash.starts_with(&prefix) {
            return nonce;
        }
        
        nonce += 1;
        
        // Safety limit to prevent infinite loops
        if nonce > u64::MAX - 1 {
            break;
        }
    }

    nonce
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_data() {
        let data = b"test transaction";
        let hash = hash_data(data);
        assert_eq!(hash.len(), 64); // SHA256 produces 64 hex characters
        
        // Same input should produce same hash
        let hash2 = hash_data(data);
        assert_eq!(hash, hash2);
        
        // Different input should produce different hash
        let hash3 = hash_data(b"different data");
        assert_ne!(hash, hash3);
    }

    #[test]
    fn test_hash_pair() {
        let left = "abc123";
        let right = "def456";
        let hash = hash_pair(left, right);
        assert_eq!(hash.len(), 64);
        
        // Order matters
        let hash_reversed = hash_pair(right, left);
        assert_ne!(hash, hash_reversed);
    }

    #[test]
    fn test_find_valid_nonce() {
        let data = "test data";
        let nonce = find_valid_nonce(data, 2); // Difficulty of 2 leading zeros
        
        let hash_input = format!("{}|{}", data, nonce);
        let hash = hash_data(hash_input.as_bytes());
        
        assert!(hash.starts_with("00"));
    }
}
