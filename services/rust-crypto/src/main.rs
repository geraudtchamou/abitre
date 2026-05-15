//! TrustEscrow Rust Crypto Server
//! 
//! High-performance microservice for cryptographic operations
//! Exposes HTTP/gRPC endpoints for:
//! - Password hashing
//! - JWT operations
//! - Encryption/Decryption

use rust_crypto::{PasswordHasherService, JwtService, EncryptionService, generate_secure_token, generate_totp_secret};
use serde::{Deserialize, Serialize};
use tokio::net::TcpListener;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tracing::{info, error, warn};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[derive(Debug, Deserialize)]
struct HashRequest {
    password: String,
}

#[derive(Debug, Serialize)]
struct HashResponse {
    hash: String,
}

#[derive(Debug, Deserialize)]
struct VerifyRequest {
    password: String,
    hash: String,
}

#[derive(Debug, Serialize)]
struct VerifyResponse {
    valid: bool,
}

#[derive(Debug, Deserialize)]
struct JwtGenerateRequest {
    user_id: String,
    email: String,
    role: String,
    device: Option<String>,
}

#[derive(Debug, Serialize)]
struct JwtGenerateResponse {
    access_token: String,
    refresh_token: String,
}

#[derive(Debug, Deserialize)]
struct JwtValidateRequest {
    token: String,
}

#[derive(Debug, Serialize)]
struct JwtValidateResponse {
    valid: bool,
    user_id: Option<String>,
    email: Option<String>,
    role: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
struct EncryptRequest {
    data: String,
    key: String,
}

#[derive(Debug, Serialize)]
struct EncryptResponse {
    encrypted: String,
}

#[derive(Debug, Deserialize)]
struct DecryptRequest {
    encrypted: String,
    key: String,
}

#[derive(Debug, Serialize)]
struct DecryptResponse {
    decrypted: String,
}

fn json_response(status: u16, body: &str) -> String {
    let status_text = match status {
        200 => "OK",
        400 => "Bad Request",
        401 => "Unauthorized",
        500 => "Internal Server Error",
        _ => "Unknown",
    };
    
    format!(
        "HTTP/1.1 {} {}\r\nContent-Type: application/json\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\nContent-Length: {}\r\n\r\n{}",
        status,
        status_text,
        body.len(),
        body
    )
}

fn cors_response() -> String {
    "HTTP/1.1 204 No Content\r\nAccess-Control-Allow-Origin: *\r\nAccess-Control-Allow-Methods: POST, OPTIONS\r\nAccess-Control-Allow-Headers: Content-Type\r\n\r\n".to_string()
}

async fn handle_client(stream: tokio::net::TcpStream, jwt_secret: String, encryption_key: [u8; 32]) {
    let mut reader = BufReader::new(stream);
    let mut writer = reader.get_mut();
    
    let mut request_line = String::new();
    if let Err(e) = reader.read_line(&mut request_line).await {
        error!("Failed to read request: {}", e);
        return;
    }
    
    // Read headers (simplified)
    let mut headers = String::new();
    loop {
        let mut line = String::new();
        if reader.read_line(&mut line).await.is_err() {
            break;
        }
        if line.trim().is_empty() {
            break;
        }
        headers.push_str(&line);
    }
    
    // Extract content length and body
    let content_length: usize = headers
        .lines()
        .find(|l| l.to_lowercase().starts_with("content-length:"))
        .and_then(|l| l.split(':').nth(1))
        .and_then(|v| v.trim().parse().ok())
        .unwrap_or(0);
    
    let mut body = vec![0u8; content_length];
    if content_length > 0 {
        if reader.read_exact(&mut body).await.is_err() {
            error!("Failed to read body");
            return;
        }
    }
    
    let path = request_line.split_whitespace().nth(1).unwrap_or("/");
    let method = request_line.split_whitespace().next().unwrap_or("GET");
    
    info!("Received {} request to {}", method, path);
    
    let response = match (method, path) {
        ("OPTIONS", _) => cors_response(),
        
        ("POST", "/hash") => {
            let req: HashRequest = match serde_json::from_slice(&body) {
                Ok(r) => r,
                Err(e) => {
                    return write_response(&mut writer, json_response(400, &format!(r#"{{"error":"{}"}}"#, e))).await;
                }
            };
            
            match PasswordHasherService::hash(&req.password) {
                Ok(hash) => {
                    let resp = serde_json::to_string(&HashResponse { hash }).unwrap();
                    json_response(200, &resp)
                }
                Err(e) => {
                    let resp = format!(r#"{{"error":"{}"}}"#, e);
                    json_response(500, &resp)
                }
            }
        }
        
        ("POST", "/verify") => {
            let req: VerifyRequest = match serde_json::from_slice(&body) {
                Ok(r) => r,
                Err(e) => {
                    return write_response(&mut writer, json_response(400, &format!(r#"{{"error":"{}"}}"#, e))).await;
                }
            };
            
            let valid = PasswordHasherService::verify(&req.password, &req.hash).unwrap_or(false);
            let resp = serde_json::to_string(&VerifyResponse { valid }).unwrap();
            json_response(200, &resp)
        }
        
        ("POST", "/jwt/generate") => {
            let req: JwtGenerateRequest = match serde_json::from_slice(&body) {
                Ok(r) => r,
                Err(e) => {
                    return write_response(&mut writer, json_response(400, &format!(r#"{{"error":"{}"}}"#, e))).await;
                }
            };
            
            let jwt_service = JwtService::new(&jwt_secret, 24);
            
            match (
                jwt_service.generate_access_token(&req.user_id, &req.email, &req.role, req.device.as_deref()),
                jwt_service.generate_refresh_token(&req.user_id),
            ) {
                (Ok(access), Ok(refresh)) => {
                    let resp = serde_json::to_string(&JwtGenerateResponse { access_token: access, refresh_token: refresh }).unwrap();
                    json_response(200, &resp)
                }
                (Err(e), _) | (_, Err(e)) => {
                    let resp = format!(r#"{{"error":"{}"}}"#, e);
                    json_response(500, &resp)
                }
            }
        }
        
        ("POST", "/jwt/validate") => {
            let req: JwtValidateRequest = match serde_json::from_slice(&body) {
                Ok(r) => r,
                Err(e) => {
                    return write_response(&mut writer, json_response(400, &format!(r#"{{"error":"{}"}}"#, e))).await;
                }
            };
            
            let jwt_service = JwtService::new(&jwt_secret, 24);
            
            match jwt_service.validate_token(&req.token) {
                Ok(claims) => {
                    let resp = serde_json::to_string(&JwtValidateResponse {
                        valid: true,
                        user_id: Some(claims.sub),
                        email: Some(claims.email),
                        role: Some(claims.role),
                        error: None,
                    }).unwrap();
                    json_response(200, &resp)
                }
                Err(e) => {
                    let resp = serde_json::to_string(&JwtValidateResponse {
                        valid: false,
                        user_id: None,
                        email: None,
                        role: None,
                        error: Some(e.to_string()),
                    }).unwrap();
                    json_response(401, &resp)
                }
            }
        }
        
        ("POST", "/encrypt") => {
            let req: EncryptRequest = match serde_json::from_slice(&body) {
                Ok(r) => r,
                Err(e) => {
                    return write_response(&mut writer, json_response(400, &format!(r#"{{"error":"{}"}}"#, e))).await;
                }
            };
            
            let key_bytes = req.key.as_bytes();
            if key_bytes.len() != 32 {
                let resp = r#"{"error":"Key must be 32 bytes"}"#;
                json_response(400, resp)
            } else {
                let mut key_array = [0u8; 32];
                key_array.copy_from_slice(key_bytes);
                
                match EncryptionService::new(&key_array) {
                    Ok(enc) => {
                        match enc.encrypt_string(&req.data) {
                            Ok(encrypted) => {
                                let resp = serde_json::to_string(&EncryptResponse { encrypted }).unwrap();
                                json_response(200, &resp)
                            }
                            Err(e) => {
                                let resp = format!(r#"{{"error":"{}"}}"#, e);
                                json_response(500, &resp)
                            }
                        }
                    }
                    Err(e) => {
                        let resp = format!(r#"{{"error":"{}"}}"#, e);
                        json_response(500, &resp)
                    }
                }
            }
        }
        
        ("POST", "/decrypt") => {
            let req: DecryptRequest = match serde_json::from_slice(&body) {
                Ok(r) => r,
                Err(e) => {
                    return write_response(&mut writer, json_response(400, &format!(r#"{{"error":"{}"}}"#, e))).await;
                }
            };
            
            let key_bytes = req.key.as_bytes();
            if key_bytes.len() != 32 {
                let resp = r#"{"error":"Key must be 32 bytes"}"#;
                json_response(400, resp)
            } else {
                let mut key_array = [0u8; 32];
                key_array.copy_from_slice(key_bytes);
                
                match EncryptionService::new(&key_array) {
                    Ok(enc) => {
                        match enc.decrypt_string(&req.encrypted) {
                            Ok(decrypted) => {
                                let resp = serde_json::to_string(&DecryptResponse { decrypted }).unwrap();
                                json_response(200, &resp)
                            }
                            Err(e) => {
                                let resp = format!(r#"{{"error":"{}"}}"#, e);
                                json_response(500, &resp)
                            }
                        }
                    }
                    Err(e) => {
                        let resp = format!(r#"{{"error":"{}"}}"#, e);
                        json_response(500, &resp)
                    }
                }
            }
        }
        
        ("POST", "/token/generate") => {
            let token = generate_secure_token(32);
            let resp = serde_json::to_string(&serde_json::json!({"token": token})).unwrap();
            json_response(200, &resp)
        }
        
        ("POST", "/totp/generate") => {
            let secret = generate_totp_secret();
            let resp = serde_json::to_string(&serde_json::json!({"secret": secret})).unwrap();
            json_response(200, &resp)
        }
        
        _ => {
            json_response(404, r#"{"error":"Not Found"}"#)
        }
    };
    
    write_response(&mut writer, response).await;
}

async fn write_response<W: AsyncWriteExt + Unpin>(writer: &mut W, response: String) {
    if let Err(e) = writer.write_all(response.as_bytes()).await {
        error!("Failed to write response: {}", e);
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // Load configuration from environment
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "default-jwt-secret-key-at-least-32-bytes!".to_string());
    
    let encryption_key_str = std::env::var("ENCRYPTION_KEY")
        .unwrap_or_else(|_| "this-is-a-32-byte-key-for-prod!!".to_string());
    
    let port = std::env::var("PORT").unwrap_or_else(|_| "3001".to_string());
    let addr = format!("0.0.0.0:{}", port);
    
    let mut encryption_key = [0u8; 32];
    encryption_key.copy_from_slice(encryption_key_str.as_bytes());

    info!("Starting TrustEscrow Rust Crypto Server on {}", addr);
    info!("JWT Secret configured: {} chars", jwt_secret.len());
    info!("Encryption Key configured: {} chars", encryption_key_str.len());

    let listener = TcpListener::bind(&addr).await?;
    info!("Server listening on {}", addr);

    loop {
        let (stream, addr) = listener.accept().await?;
        info!("New connection from {}", addr);
        
        let jwt_secret_clone = jwt_secret.clone();
        let encryption_key_clone = encryption_key;
        
        tokio::spawn(async move {
            handle_client(stream, jwt_secret_clone, encryption_key_clone).await;
        });
    }
}
