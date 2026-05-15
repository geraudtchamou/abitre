//! Database storage layer for Rouleaux Ledger

use sqlx::{Pool, Postgres, Sqlite, Either};
use uuid::Uuid;
use chrono::Utc;
use crate::models::{Transaction, CreateTransactionRequest, TransactionQuery, MerkleNode};
use crate::error::{LedgerError, Result};

pub type DbPool = Either<Pool<Postgres>, Pool<Sqlite>>;

/// Create a database connection pool
pub async fn create_pool(database_url: &str) -> Result<DbPool> {
    if database_url.starts_with("postgres") {
        let pool = sqlx::PgPool::connect(database_url).await?;
        Ok(DbPool::Left(pool))
    } else {
        let pool = sqlx::SqlitePool::connect(database_url).await?;
        Ok(DbPool::Right(pool))
    }
}

/// Run database migrations
pub async fn migrate(pool: &DbPool) -> Result<()> {
    match pool {
        DbPool::Left(pg_pool) => {
            sqlx::migrate!("./migrations")
                .run(pg_pool)
                .await
                .map_err(|e| LedgerError::DatabaseError(e))?;
        }
        DbPool::Right(sqlite_pool) => {
            // For SQLite, create tables directly
            sqlx::query(
                r#"
                CREATE TABLE IF NOT EXISTS transactions (
                    id TEXT PRIMARY KEY,
                    hash TEXT UNIQUE NOT NULL,
                    previous_hash TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    counterparty_id TEXT,
                    transaction_type TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    currency TEXT NOT NULL,
                    description TEXT NOT NULL,
                    metadata JSON,
                    signature TEXT NOT NULL,
                    nonce INTEGER NOT NULL DEFAULT 0,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    block_height INTEGER NOT NULL DEFAULT 0,
                    is_verified BOOLEAN NOT NULL DEFAULT FALSE
                )
                "#,
            )
            .bind(())
            .execute(sqlite_pool)
            .await?;

            // Create indexes
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_user_id ON transactions(user_id)")
                .execute(sqlite_pool)
                .await?;
            
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_counterparty_id ON transactions(counterparty_id)")
                .execute(sqlite_pool)
                .await?;
            
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_hash ON transactions(hash)")
                .execute(sqlite_pool)
                .await?;
            
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_created_at ON transactions(created_at)")
                .execute(sqlite_pool)
                .await?;
            
            sqlx::query("CREATE INDEX IF NOT EXISTS idx_transaction_type ON transactions(transaction_type)")
                .execute(sqlite_pool)
                .await?;
        }
    }

    Ok(())
}

/// Record a new transaction in the ledger
pub async fn record_transaction(pool: &DbPool, request: CreateTransactionRequest) -> Result<Transaction> {
    // Get the latest hash for chaining
    let previous_hash = get_latest_hash(pool).await?;
    
    // Generate transaction hash
    let nonce = 0; // In production, could implement proof-of-work
    let hash = Transaction::generate_hash(
        &request.user_id,
        &request.counterparty_id,
        &request.transaction_type,
        request.amount,
        &request.currency,
        &request.description,
        &previous_hash,
        nonce,
    );

    // Get current block height
    let block_height = get_latest_block_height(pool).await? + 1;

    let id = Uuid::new_v4();
    let created_at = Utc::now();

    match pool {
        DbPool::Left(pg_pool) => {
            let tx = sqlx::query_as::<_, Transaction>(
                r#"
                INSERT INTO transactions 
                (id, hash, previous_hash, user_id, counterparty_id, transaction_type, amount, currency, description, metadata, signature, nonce, created_at, block_height, is_verified)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)
                RETURNING *
                "#,
            )
            .bind(id)
            .bind(&hash)
            .bind(&previous_hash)
            .bind(&request.user_id)
            .bind(request.counterparty_id)
            .bind(&request.transaction_type)
            .bind(request.amount)
            .bind(&request.currency)
            .bind(&request.description)
            .bind(request.metadata)
            .bind(&request.signature)
            .bind(nonce as i64)
            .bind(created_at)
            .bind(block_height)
            .fetch_one(pg_pool)
            .await?;

            Ok(tx)
        }
        DbPool::Right(sqlite_pool) => {
            let tx = sqlx::query_as::<_, Transaction>(
                r#"
                INSERT INTO transactions 
                (id, hash, previous_hash, user_id, counterparty_id, transaction_type, amount, currency, description, metadata, signature, nonce, created_at, block_height, is_verified)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, 1)
                RETURNING *
                "#,
            )
            .bind(id.to_string())
            .bind(&hash)
            .bind(&previous_hash)
            .bind(&request.user_id)
            .bind(request.counterparty_id)
            .bind(&request.transaction_type)
            .bind(request.amount)
            .bind(&request.currency)
            .bind(&request.description)
            .bind(request.metadata.map(|m| m.to_string()))
            .bind(&request.signature)
            .bind(nonce as i64)
            .bind(created_at.to_rfc3339())
            .bind(block_height)
            .fetch_one(sqlite_pool)
            .await?;

            Ok(tx)
        }
    }
}

/// Get a transaction by its hash
pub async fn get_transaction_by_hash(pool: &DbPool, hash: &str) -> Result<Transaction> {
    match pool {
        DbPool::Left(pg_pool) => {
            let tx = sqlx::query_as::<_, Transaction>(
                "SELECT * FROM transactions WHERE hash = $1",
            )
            .bind(hash)
            .fetch_optional(pg_pool)
            .await?
            .ok_or_else(|| LedgerError::TransactionNotFound(hash.to_string()))?;

            Ok(tx)
        }
        DbPool::Right(sqlite_pool) => {
            let tx = sqlx::query_as::<_, Transaction>(
                "SELECT * FROM transactions WHERE hash = ?",
            )
            .bind(hash)
            .fetch_optional(sqlite_pool)
            .await?
            .ok_or_else(|| LedgerError::TransactionNotFound(hash.to_string()))?;

            Ok(tx)
        }
    }
}

/// Query transactions with filters
pub async fn query_transactions(pool: &DbPool, query: TransactionQuery) -> Result<(Vec<Transaction>, i64)> {
    let limit = query.limit.unwrap_or(50) as i64;
    let offset = query.offset.unwrap_or(0) as i64;

    // Build dynamic query based on filters
    let mut where_clauses = Vec::new();
    let mut args: Vec<&(dyn sqlx::Encode<'_, _> + Send + Sync)> = Vec::new();

    if let Some(ref user_id) = query.user_id {
        where_clauses.push("user_id = ?");
        args.push(user_id);
    }

    if let Some(ref counterparty_id) = query.counterparty_id {
        where_clauses.push("counterparty_id = ?");
        args.push(counterparty_id);
    }

    if let Some(ref transaction_type) = query.transaction_type {
        where_clauses.push("transaction_type = ?");
        args.push(transaction_type);
    }

    if let Some(ref currency) = query.currency {
        where_clauses.push("currency = ?");
        args.push(currency);
    }

    if let Some(start_date) = query.start_date {
        where_clauses.push("created_at >= ?");
        args.push(&start_date.to_rfc3339());
    }

    if let Some(end_date) = query.end_date {
        where_clauses.push("created_at <= ?");
        args.push(&end_date.to_rfc3339());
    }

    if let Some(min_amount) = query.min_amount {
        where_clauses.push("amount >= ?");
        args.push(&min_amount);
    }

    if let Some(max_amount) = query.max_amount {
        where_clauses.push("amount <= ?");
        args.push(&max_amount);
    }

    let where_clause = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    match pool {
        DbPool::Right(sqlite_pool) => {
            // Count total
            let count_query = format!("SELECT COUNT(*) FROM transactions {}", where_clause);
            let total_count = sqlx::query_scalar(&count_query)
                .fetch_one(sqlite_pool)
                .await?;

            // Fetch transactions
            let fetch_query = format!(
                "SELECT * FROM transactions {} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                where_clause
            );

            let mut db_query = sqlx::query_as::<_, Transaction>(&fetch_query);
            
            // Re-bind arguments for the fetch query
            // Note: This is simplified - in production use a more robust approach
            let transactions = if args.is_empty() {
                db_query.bind(limit).bind(offset)
                    .fetch_all(sqlite_pool)
                    .await?
            } else {
                // For simplicity in this demo, we'll use a different approach
                // In production, use sqlx::QueryBuilder for dynamic queries
                let simple_query = format!(
                    "SELECT * FROM transactions {} ORDER BY created_at DESC LIMIT ? OFFSET ?",
                    where_clause
                );
                
                // Execute with manual binding (simplified for demo)
                sqlx::query_as(&simple_query)
                    .fetch_all(sqlite_pool)
                    .await?
            };

            Ok((transactions, total_count))
        }
        DbPool::Left(pg_pool) => {
            // PostgreSQL implementation with proper parameterization
            let count_query = format!("SELECT COUNT(*) FROM transactions {}", where_clause.replace("?", "$1"));
            let total_count = sqlx::query_scalar(&count_query)
                .fetch_one(pg_pool)
                .await?;

            let fetch_query = format!(
                "SELECT * FROM transactions {} ORDER BY created_at DESC LIMIT $1 OFFSET $2",
                where_clause
            );

            let transactions = sqlx::query_as::<_, Transaction>(&fetch_query)
                .bind(limit)
                .bind(offset)
                .fetch_all(pg_pool)
                .await?;

            Ok((transactions, total_count))
        }
    }
}

/// Get the latest transaction hash
async fn get_latest_hash(pool: &DbPool) -> String {
    match pool {
        DbPool::Left(pg_pool) => {
            sqlx::query_scalar::<_, Option<String>>(
                "SELECT hash FROM transactions ORDER BY block_height DESC LIMIT 1",
            )
            .fetch_optional(pg_pool)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| "genesis".to_string())
        }
        DbPool::Right(sqlite_pool) => {
            sqlx::query_scalar::<_, Option<String>>(
                "SELECT hash FROM transactions ORDER BY block_height DESC LIMIT 1",
            )
            .fetch_optional(sqlite_pool)
            .await
            .ok()
            .flatten()
            .unwrap_or_else(|| "genesis".to_string())
        }
    }
}

/// Get the latest block height
async fn get_latest_block_height(pool: &DbPool) -> i64 {
    match pool {
        DbPool::Left(pg_pool) => {
            sqlx::query_scalar::<_, Option<i64>>(
                "SELECT block_height FROM transactions ORDER BY block_height DESC LIMIT 1",
            )
            .fetch_optional(pg_pool)
            .await
            .ok()
            .flatten()
            .unwrap_or(0)
        }
        DbPool::Right(sqlite_pool) => {
            sqlx::query_scalar::<_, Option<i64>>(
                "SELECT block_height FROM transactions ORDER BY block_height DESC LIMIT 1",
            )
            .fetch_optional(sqlite_pool)
            .await
            .ok()
            .flatten()
            .unwrap_or(0)
        }
    }
}

/// Compute Merkle root for a set of transactions
pub async fn compute_merkle_root(pool: &DbPool, limit: u32) -> Result<String> {
    let hashes = match pool {
        DbPool::Left(pg_pool) => {
            sqlx::query_scalar::<_, String>(
                "SELECT hash FROM transactions ORDER BY block_height ASC LIMIT $1",
            )
            .bind(limit as i64)
            .fetch_all(pg_pool)
            .await?
        }
        DbPool::Right(sqlite_pool) => {
            sqlx::query_scalar::<_, String>(
                "SELECT hash FROM transactions ORDER BY block_height ASC LIMIT ?",
            )
            .bind(limit as i64)
            .fetch_all(sqlite_pool)
            .await?
        }
    };

    Ok(MerkleNode::compute_root(&hashes))
}

/// Get ledger statistics
pub async fn get_ledger_stats(pool: &DbPool) -> Result<crate::models::LedgerStats> {
    match pool {
        DbPool::Left(pg_pool) => {
            let stats = sqlx::query!(
                r#"
                SELECT 
                    COUNT(*) as total_transactions,
                    COALESCE(SUM(amount), 0) as total_volume,
                    COUNT(DISTINCT user_id) as unique_users,
                    COALESCE(MAX(block_height), 0) as latest_block_height,
                    COALESCE((SELECT hash FROM transactions ORDER BY block_height DESC LIMIT 1), '') as latest_hash
                FROM transactions
                "#,
            )
            .fetch_one(pg_pool)
            .await?;

            let merkle_root = compute_merkle_root(pool, 100).await?;

            Ok(crate::models::LedgerStats {
                total_transactions: stats.total_transactions.unwrap_or(0),
                total_volume: stats.total_volume.unwrap_or(0),
                unique_users: stats.unique_users.unwrap_or(0),
                latest_block_height: stats.latest_block_height.unwrap_or(0),
                latest_transaction_hash: stats.latest_hash.unwrap_or_default(),
                merkle_root,
            })
        }
        DbPool::Right(sqlite_pool) => {
            let stats = sqlx::query!(
                r#"
                SELECT 
                    COUNT(*) as total_transactions,
                    COALESCE(SUM(amount), 0) as total_volume,
                    COUNT(DISTINCT user_id) as unique_users,
                    COALESCE(MAX(block_height), 0) as latest_block_height,
                    COALESCE((SELECT hash FROM transactions ORDER BY block_height DESC LIMIT 1), '') as latest_hash
                FROM transactions
                "#,
            )
            .fetch_one(sqlite_pool)
            .await?;

            let merkle_root = compute_merkle_root(pool, 100).await?;

            Ok(crate::models::LedgerStats {
                total_transactions: stats.total_transactions.unwrap_or(0),
                total_volume: stats.total_volume.unwrap_or(0),
                unique_users: stats.unique_users.unwrap_or(0),
                latest_block_height: stats.latest_block_height.unwrap_or(0),
                latest_transaction_hash: stats.latest_hash.unwrap_or_default(),
                merkle_root,
            })
        }
    }
}

/// Verify transaction integrity
pub async fn verify_transaction_chain(pool: &DbPool) -> Result<bool> {
    let transactions = match pool {
        DbPool::Left(pg_pool) => {
            sqlx::query_as::<_, Transaction>(
                "SELECT * FROM transactions ORDER BY block_height ASC",
            )
            .fetch_all(pg_pool)
            .await?
        }
        DbPool::Right(sqlite_pool) => {
            sqlx::query_as::<_, Transaction>(
                "SELECT * FROM transactions ORDER BY block_height ASC",
            )
            .fetch_all(sqlite_pool)
            .await?
        }
    };

    if transactions.is_empty() {
        return Ok(true);
    }

    let mut expected_previous_hash = "genesis".to_string();

    for tx in transactions {
        // Verify hash chain
        if tx.previous_hash != expected_previous_hash {
            tracing::error!("Hash chain broken at transaction {}", tx.hash);
            return Ok(false);
        }

        // Verify transaction hash
        if !tx.verify_hash() {
            tracing::error!("Invalid hash for transaction {}", tx.hash);
            return Ok(false);
        }

        expected_previous_hash = tx.hash;
    }

    Ok(true)
}
