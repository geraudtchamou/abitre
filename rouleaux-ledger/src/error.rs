//! Error handling for Rouleaux Ledger

use thiserror::Error;
use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

#[derive(Error, Debug)]
pub enum LedgerError {
    #[error("Transaction not found: {0}")]
    TransactionNotFound(String),
    
    #[error("Invalid transaction hash: {0}")]
    InvalidHash(String),
    
    #[error("Database error: {0}")]
    DatabaseError(#[from] sqlx::Error),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    
    #[error("Validation error: {0}")]
    ValidationError(String),
    
    #[error("Internal server error: {0}")]
    InternalError(String),
}

impl IntoResponse for LedgerError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            LedgerError::TransactionNotFound(msg) => {
                (StatusCode::NOT_FOUND, json!({"error": msg}))
            }
            LedgerError::InvalidHash(msg) => {
                (StatusCode::BAD_REQUEST, json!({"error": msg}))
            }
            LedgerError::ValidationError(msg) => {
                (StatusCode::BAD_REQUEST, json!({"error": msg}))
            }
            LedgerError::DatabaseError(err) => {
                tracing::error!("Database error: {}", err);
                (StatusCode::INTERNAL_SERVER_ERROR, json!({"error": "Database operation failed"}))
            }
            LedgerError::SerializationError(err) => {
                tracing::error!("Serialization error: {}", err);
                (StatusCode::INTERNAL_SERVER_ERROR, json!({"error": "Failed to process data"}))
            }
            LedgerError::InternalError(msg) => {
                tracing::error!("Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, json!({"error": msg}))
            }
        };

        (status, Json(error_message)).into_response()
    }
}

pub type Result<T> = std::result::Result<T, LedgerError>;
