//! API routes and handlers for Rouleaux Ledger

use axum::{
    routing::{get, post},
    Router,
    extract::{State, Query, Path, Json},
    http::StatusCode,
    response::IntoResponse,
};
use tower_http::cors::{CorsLayer, Any};
use serde::{Deserialize, Serialize};
use crate::models::{Transaction, CreateTransactionRequest, TransactionQuery, TransactionListResponse, LedgerStats};
use crate::storage;
use crate::error::{LedgerError, Result};
use sqlx::Either;
use sqlx::{Pool, Postgres, Sqlite};

/// Application state shared across handlers
#[derive(Clone)]
pub struct AppState {
    pub db: Either<Pool<Postgres>, Pool<Sqlite>>,
    pub ledger_name: String,
}

/// Health check response
#[derive(Serialize)]
struct HealthResponse {
    status: String,
    ledger_name: String,
    timestamp: String,
}

/// Create the API router with all routes
pub fn create_router(state: AppState) -> Router {
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    Router::new()
        .route("/health", get(health_check))
        .route("/stats", get(get_stats))
        .route("/transactions", post(create_transaction))
        .route("/transactions", get(query_transactions_handler))
        .route("/transactions/:hash", get(get_transaction))
        .route("/transactions/verify", get(verify_chain))
        .route("/merkle-root", get(get_merkle_root))
        .layer(cors)
        .with_state(state)
}

/// Health check endpoint
async fn health_check(State(state): State<AppState>) -> impl IntoResponse {
    let response = HealthResponse {
        status: "healthy".to_string(),
        ledger_name: state.ledger_name,
        timestamp: chrono::Utc::now().to_rfc3339(),
    };

    Json(response)
}

/// Get ledger statistics
async fn get_stats(State(state): State<AppState>) -> Result<Json<LedgerStats>> {
    let stats = storage::get_ledger_stats(&state.db).await?;
    Ok(Json(stats))
}

/// Create a new transaction
async fn create_transaction(
    State(state): State<AppState>,
    Json(request): Json<CreateTransactionRequest>,
) -> Result<(StatusCode, Json<Transaction>)> {
    // Validate request
    if request.user_id.is_empty() {
        return Err(LedgerError::ValidationError("user_id is required".to_string()));
    }

    if request.transaction_type.is_empty() {
        return Err(LedgerError::ValidationError("transaction_type is required".to_string()));
    }

    if request.amount <= 0 {
        return Err(LedgerError::ValidationError("amount must be positive".to_string()));
    }

    if request.currency.is_empty() {
        return Err(LedgerError::ValidationError("currency is required".to_string()));
    }

    if request.signature.is_empty() {
        return Err(LedgerError::ValidationError("signature is required".to_string()));
    }

    let transaction = storage::record_transaction(&state.db, request).await?;

    tracing::info!(
        "Transaction recorded: {} | User: {} | Amount: {} {}",
        transaction.hash,
        transaction.user_id,
        transaction.amount,
        transaction.currency
    );

    Ok((StatusCode::CREATED, Json(transaction)))
}

/// Query transactions with filters
async fn query_transactions_handler(
    State(state): State<AppState>,
    Query(query): Query<TransactionQuery>,
) -> Result<Json<TransactionListResponse>> {
    let (transactions, total_count) = storage::query_transactions(&state.db, query).await?;
    
    let has_more = transactions.len() as u32 >= transactions.len() as u32;
    let merkle_root = storage::compute_merkle_root(&state.db, 100).await?;

    let response = TransactionListResponse {
        transactions,
        total_count,
        has_more,
        merkle_root,
    };

    Ok(Json(response))
}

/// Get a single transaction by hash
async fn get_transaction(
    State(state): State<AppState>,
    Path(hash): Path<String>,
) -> Result<Json<Transaction>> {
    // Validate hash format (should be 64 hex characters)
    if hash.len() != 64 || !hash.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(LedgerError::InvalidHash(hash));
    }

    let transaction = storage::get_transaction_by_hash(&state.db, &hash).await?;
    Ok(Json(transaction))
}

/// Verify the integrity of the transaction chain
async fn verify_chain(State(state): State<AppState>) -> Result<Json<serde_json::Value>> {
    let is_valid = storage::verify_transaction_chain(&state.db).await?;
    
    Ok(Json(serde_json::json!({
        "valid": is_valid,
        "message": if is_valid { 
            "Transaction chain is valid and intact" 
        } else { 
            "Transaction chain integrity compromised" 
        },
        "verified_at": chrono::Utc::now().to_rfc3339()
    })))
}

/// Get current Merkle root
async fn get_merkle_root(
    State(state): State<AppState>,
    Query(params): Query<MerkleRootQuery>,
) -> Result<Json<serde_json::Value>> {
    let limit = params.limit.unwrap_or(100);
    let merkle_root = storage::compute_merkle_root(&state.db, limit).await?;

    Ok(Json(serde_json::json!({
        "merkle_root": merkle_root,
        "transactions_included": limit,
        "computed_at": chrono::Utc::now().to_rfc3339()
    })))
}

/// Query parameters for Merkle root endpoint
#[derive(Deserialize)]
struct MerkleRootQuery {
    limit: Option<u32>,
}

/// Error handler for better error responses
impl IntoResponse for LedgerError {
    fn into_response(self) -> axum::response::Response {
        use axum::http::StatusCode;
        use axum::Json;
        use serde_json::json;

        let (status, message) = match &self {
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

        (status, Json(message)).into_response()
    }
}
