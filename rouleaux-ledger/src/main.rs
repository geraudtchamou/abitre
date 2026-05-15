//! Rouleaux Open Ledger
//! 
//! A high-performance, immutable ledger system for recording and querying transactions.
//! Features:
//! - Cryptographic hashing for immutability
//! - Append-only transaction log
//! - Real-time querying by user, hash, or time range
//! - Merkle tree root verification
//! - Async API with Axum

mod models;
mod storage;
mod crypto;
mod api;
mod error;

use anyhow::Result;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use dotenvy::dotenv;

#[tokio::main]
async fn main() -> Result<()> {
    // Load environment variables
    dotenv().ok();

    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "rouleaux_ledger=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("🚀 Starting Rouleaux Open Ledger...");

    // Initialize database connection
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "sqlite:./rouleaux.db".to_string());
    
    let pool = storage::create_pool(&database_url).await?;
    storage::migrate(&pool).await?;

    tracing::info!("📦 Database initialized at: {}", database_url);

    // Create shared state
    let state = api::AppState {
        db: pool,
        ledger_name: "Rouleaux".to_string(),
    };

    // Build router
    let app = api::create_router(state);

    // Get port from env or default to 3001
    let port = std::env::var("ROULEAUX_PORT")
        .unwrap_or_else(|_| "3001".to_string());
    let addr = format!("0.0.0.0:{}", port);

    tracing::info!("🌐 Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
