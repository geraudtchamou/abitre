//! TrustEscrow Rust Cryptographic Library
//! 
//! High-performance cryptographic utilities for:
//! - Password hashing (Argon2, bcrypt)
//! - JWT token generation/validation
//! - AES-GCM encryption/decryption
//! - Secure random generation

use argon2::{password_hash::SaltString, Argon2, PasswordHasher, PasswordVerifier};
use aes_gcm::{aead::Aead, Aes256Gcm, KeyInit, Nonce};
use rand::rngs::OsRng;
use jsonwebtoken::{encode, decode, Header, Algorithm, Validation, EncodingKey, DecodingKey};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use chrono::{Utc, Duration};
use uuid::Uuid;
use std::time::{SystemTime, UNIX_EPOCH};

/// Crypto service errors
#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Password hashing failed: {0}")]
    PasswordHash(String),
    #[error("Password verification failed")]
    PasswordVerify,
    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),
    #[error("Encryption failed: {0}")]
    Encryption(String),
    #[error("Decryption failed: {0}")]
    Decryption(String),
    #[error("Invalid nonce size")]
    InvalidNonce,
}

pub type Result<T> = std::result::Result<T, CryptoError>;

/// JWT Claims structure
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,          // Subject (user ID)
    pub email: String,
    pub role: String,
    pub exp: usize,           // Expiration time
    pub iat: usize,           // Issued at
    pub jti: String,          // JWT ID for uniqueness
    pub device: Option<String>,
}

/// Password hasher using Argon2
pub struct PasswordHasherService;

impl PasswordHasherService {
    /// Hash a password using Argon2
    pub fn hash(password: &str) -> Result<String> {
        let salt = SaltString::generate(&mut OsRng);
        let argon2 = Argon2::default();
        
        match argon2.hash_password(password.as_bytes(), &salt) {
            Ok(hash) => Ok(hash.to_string()),
            Err(e) => Err(CryptoError::PasswordHash(e.to_string())),
        }
    }

    /// Verify a password against a hash
    pub fn verify(password: &str, hash: &str) -> Result<bool> {
        let parsed_hash = argon2::PasswordHash::new(hash)
            .map_err(|e| CryptoError::PasswordHash(e.to_string()))?;
        
        match Argon2::default().verify_password(password.as_bytes(), &parsed_hash) {
            Ok(_) => Ok(true),
            Err(_) => Err(CryptoError::PasswordVerify),
        }
    }
}

/// JWT Service
pub struct JwtService {
    secret: Vec<u8>,
    expiration_hours: i64,
}

impl JwtService {
    pub fn new(secret: &str, expiration_hours: i64) -> Self {
        Self {
            secret: secret.as_bytes().to_vec(),
            expiration_hours,
        }
    }

    /// Generate access token
    pub fn generate_access_token(
        &self,
        user_id: &str,
        email: &str,
        role: &str,
        device: Option<&str>,
    ) -> Result<String> {
        let now = Utc::now();
        let exp = now + Duration::hours(self.expiration_hours);

        let claims = Claims {
            sub: user_id.to_string(),
            email: email.to_string(),
            role: role.to_string(),
            exp: exp.timestamp() as usize,
            iat: now.timestamp() as usize,
            jti: Uuid::new_v4().to_string(),
            device: device.map(String::from),
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(&self.secret),
        )
        .map_err(CryptoError::Jwt)
    }

    /// Generate refresh token (longer expiration)
    pub fn generate_refresh_token(&self, user_id: &str) -> Result<String> {
        let now = Utc::now();
        let exp = now + Duration::days(30);

        let claims = Claims {
            sub: user_id.to_string(),
            email: String::new(),
            role: String::new(),
            exp: exp.timestamp() as usize,
            iat: now.timestamp() as usize,
            jti: Uuid::new_v4().to_string(),
            device: None,
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(&self.secret),
        )
        .map_err(CryptoError::Jwt)
    }

    /// Validate and decode token
    pub fn validate_token(&self, token: &str) -> Result<Claims> {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = true;

        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(&self.secret),
            &validation,
        )?;

        Ok(token_data.claims)
    }

    /// Check if token is expired
    pub fn is_expired(&self, token: &str) -> bool {
        match self.validate_token(token) {
            Ok(_) => false,
            Err(CryptoError::Jwt(e)) => matches!(e.kind(), jsonwebtoken::errors::ErrorKind::ExpiredSignature),
            Err(_) => true,
        }
    }
}

/// AES-GCM Encryption Service
pub struct EncryptionService {
    key: [u8; 32],
}

impl EncryptionService {
    pub fn new(key: &[u8]) -> Result<Self> {
        if key.len() != 32 {
            return Err(CryptoError::Encryption("Key must be 32 bytes".to_string()));
        }
        
        let mut key_array = [0u8; 32];
        key_array.copy_from_slice(key);
        
        Ok(Self { key: key_array })
    }

    /// Encrypt data using AES-256-GCM
    pub fn encrypt(&self, plaintext: &[u8]) -> Result<Vec<u8>> {
        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .map_err(|e| CryptoError::Encryption(e.to_string()))?;

        let nonce = Nonce::from(OsRng.gen::<[u8; 12]>());
        let ciphertext = cipher
            .encrypt(&nonce, plaintext)
            .map_err(|e| CryptoError::Encryption(e.to_string()))?;

        // Prepend nonce to ciphertext
        let mut result = nonce.to_vec();
        result.extend_from_slice(&ciphertext);
        
        Ok(result)
    }

    /// Decrypt data using AES-256-GCM
    pub fn decrypt(&self, ciphertext_with_nonce: &[u8]) -> Result<Vec<u8>> {
        if ciphertext_with_nonce.len() < 12 {
            return Err(CryptoError::InvalidNonce);
        }

        let (nonce, ciphertext) = ciphertext_with_nonce.split_at(12);
        
        let cipher = Aes256Gcm::new_from_slice(&self.key)
            .map_err(|e| CryptoError::Decryption(e.to_string()))?;

        let plaintext = cipher
            .decrypt(Nonce::from_slice(nonce), ciphertext)
            .map_err(|e| CryptoError::Decryption(e.to_string()))?;

        Ok(plaintext)
    }

    /// Encrypt sensitive data (e.g., 2FA secrets, API keys)
    pub fn encrypt_string(&self, data: &str) -> Result<String> {
        let encrypted = self.encrypt(data.as_bytes())?;
        Ok(base64::encode(encrypted))
    }

    /// Decrypt sensitive data
    pub fn decrypt_string(&self, encoded: &str) -> Result<String> {
        let decoded = base64::decode(encoded)
            .map_err(|e| CryptoError::Decryption(e.to_string()))?;
        let decrypted = self.decrypt(&decoded)?;
        String::from_utf8(decrypted)
            .map_err(|e| CryptoError::Decryption(e.to_string()))
    }
}

/// Generate secure random string
pub fn generate_secure_token(length: usize) -> String {
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let mut rng = OsRng;
    
    (0..length)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Generate TOTP secret
pub fn generate_totp_secret() -> String {
    const BASE32_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    let mut rng = OsRng;
    
    (0..32)
        .map(|_| {
            let idx = rng.gen_range(0..BASE32_CHARS.len());
            BASE32_CHARS[idx] as char
        })
        .collect()
}

/// Device fingerprinting helper
pub fn generate_device_fingerprint(user_agent: &str, ip: &str, screen: &str) -> String {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    
    let mut hasher = DefaultHasher::new();
    format!("{}|{}|{}", user_agent, ip, screen).hash(&mut hasher);
    format!("{:x}", hasher.finish())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_password_hash_verify() {
        let password = "SecurePassword123!";
        let hash = PasswordHasherService::hash(password).unwrap();
        assert!(PasswordHasherService::verify(password, &hash).unwrap());
        assert!(PasswordHasherService::verify("WrongPassword", &hash).is_err());
    }

    #[test]
    fn test_jwt_generation_validation() {
        let jwt_service = JwtService::new("test-secret-key-at-least-32-bytes!", 24);
        
        let token = jwt_service.generate_access_token(
            "user-123",
            "test@example.com",
            "user",
            Some("chrome-windows"),
        ).unwrap();
        
        let claims = jwt_service.validate_token(&token).unwrap();
        assert_eq!(claims.sub, "user-123");
        assert_eq!(claims.email, "test@example.com");
        assert_eq!(claims.role, "user");
    }

    #[test]
    fn test_encryption_decryption() {
        let key = b"this-is-a-32-byte-key-for-test!!";
        let encryption = EncryptionService::new(key).unwrap();
        
        let original = "Sensitive data to encrypt";
        let encrypted = encryption.encrypt_string(original).unwrap();
        let decrypted = encryption.decrypt_string(&encrypted).unwrap();
        
        assert_eq!(original, decrypted);
    }

    #[test]
    fn test_secure_token_generation() {
        let token1 = generate_secure_token(32);
        let token2 = generate_secure_token(32);
        
        assert_eq!(token1.len(), 32);
        assert_ne!(token1, token2);
    }
}
