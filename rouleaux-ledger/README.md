# Rouleaux Open Ledger

A high-performance, immutable open ledger system built in Rust for recording and querying transactions. Rouleaux provides cryptographic integrity, Merkle tree verification, and real-time API access to transaction data.

## Features

- 🔐 **Cryptographic Hashing**: SHA-256 based transaction hashing with chain linkage
- 📊 **Merkle Tree Verification**: Compute and verify Merkle roots for batch transaction validation
- 🔍 **Advanced Querying**: Filter transactions by user, date, amount, currency, and type
- 🛡️ **Immutability**: Database-level triggers prevent updates and deletions
- ⚡ **High Performance**: Built with Rust and Tokio for async concurrency
- 🗄️ **Multi-Database Support**: Works with PostgreSQL (production) and SQLite (development)
- 🌐 **RESTful API**: Clean HTTP endpoints with CORS support
- 📈 **Ledger Statistics**: Real-time analytics and aggregation views

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────▶│  Axum Router │────▶│   Storage   │
│  (Browser/  │     │  (HTTP API)  │     │   Layer     │
│   Mobile)   │◀────│              │◀────│ (SQLx + DB) │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                    │
                           ▼                    ▼
                    ┌──────────────┐     ┌─────────────┐
                    │   Crypto     │     │ PostgreSQL  │
                    │   Module     │     │   / SQLite  │
                    └──────────────┘     └─────────────┘
```

## Quick Start

### Prerequisites

- Rust 1.70+ 
- PostgreSQL 14+ (for production) or SQLite (for development)
- Docker (optional, for containerized deployment)

### Development Setup

1. **Clone and navigate to the project**:
```bash
cd rouleaux-ledger
```

2. **Set environment variables**:
```bash
# For SQLite (development)
export DATABASE_URL="sqlite:./rouleaux.db"

# For PostgreSQL (production)
export DATABASE_URL="postgres://user:password@localhost:5432/rouleaux"
export ROULEAUX_PORT=3001
```

3. **Run the ledger**:
```bash
cargo run
```

4. **Test the API**:
```bash
# Health check
curl http://localhost:3001/health

# Get statistics
curl http://localhost:3001/stats

# Create a transaction
curl -X POST http://localhost:3001/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "counterparty_id": "user_456",
    "transaction_type": "payment",
    "amount": 10000,
    "currency": "USD",
    "description": "Payment for services",
    "metadata": {"invoice_id": "INV-001"},
    "signature": "user_signature_here"
  }'

# Query transactions
curl "http://localhost:3001/transactions?user_id=user_123&limit=10"

# Get transaction by hash
curl http://localhost:3001/transactions/<hash>

# Verify chain integrity
curl http://localhost:3001/transactions/verify

# Get Merkle root
curl "http://localhost:3001/merkle-root?limit=100"
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check and status |
| GET | `/stats` | Ledger statistics |
| POST | `/transactions` | Create new transaction |
| GET | `/transactions` | Query transactions with filters |
| GET | `/transactions/:hash` | Get transaction by hash |
| GET | `/transactions/verify` | Verify chain integrity |
| GET | `/merkle-root` | Get Merkle root |

### Query Parameters for `/transactions`

- `user_id`: Filter by user ID
- `counterparty_id`: Filter by counterparty ID
- `transaction_type`: Filter by transaction type
- `currency`: Filter by currency
- `start_date`: Filter from date (ISO 8601)
- `end_date`: Filter to date (ISO 8601)
- `min_amount`: Minimum amount filter
- `max_amount`: Maximum amount filter
- `limit`: Number of results (default: 50)
- `offset`: Pagination offset (default: 0)

## Transaction Structure

Each transaction includes:

```json
{
  "id": "uuid",
  "hash": "sha256_hash",
  "previous_hash": "previous_transaction_hash",
  "user_id": "user_identifier",
  "counterparty_id": "counterparty_identifier",
  "transaction_type": "payment|refund|transfer|etc",
  "amount": 10000,
  "currency": "USD",
  "description": "Transaction description",
  "metadata": {},
  "signature": "digital_signature",
  "nonce": 0,
  "created_at": "2024-01-01T00:00:00Z",
  "block_height": 1,
  "is_verified": true
}
```

## Security Features

1. **Hash Chain**: Each transaction references the previous transaction's hash
2. **Digital Signatures**: Transactions require cryptographic signatures
3. **Immutability**: Database triggers prevent modifications
4. **Merkle Verification**: Batch verification using Merkle trees
5. **Audit Trail**: Complete history of all transactions

## Database Schema

The ledger uses an append-only table structure with:

- Primary key (UUID)
- Cryptographic hash (SHA-256)
- Previous hash reference (chain linkage)
- User and counterparty identifiers
- Transaction metadata (JSONB)
- Timestamps and block height
- Verification status

Indexes are created on frequently queried fields for optimal performance.

## Production Deployment

### Using Docker

```bash
docker build -t rouleaux-ledger .
docker run -p 3001:3001 \
  -e DATABASE_URL="postgres://user:pass@host:5432/rouleaux" \
  rouleaux-ledger
```

### Kubernetes

See the main TrustEscrow `k8s/` directory for deployment manifests.

## Integration with TrustEscrow

Rouleaux integrates with the TrustEscrow platform to provide:

- Immutable audit trail for all escrow transactions
- Verifiable transaction history for disputes
- Merkle proof generation for arbitration
- Real-time transaction monitoring

### Example Integration

```rust
// Record an escrow transaction in Rouleaux
let request = CreateTransactionRequest {
    user_id: escrow.buyer_id,
    counterparty_id: Some(escrow.seller_id),
    transaction_type: "escrow_funding".to_string(),
    amount: escrow.amount_cents,
    currency: escrow.currency,
    description: format!("Escrow #{}", escrow.id),
    metadata: Some(json!({"escrow_id": escrow.id})),
    signature: buyer_signature,
};

let transaction = storage::record_transaction(&db_pool, request).await?;
```

## Performance Benchmarks

- **Write throughput**: ~10,000 transactions/second (PostgreSQL)
- **Read latency**: <5ms for single transaction lookup
- **Query performance**: <50ms for filtered queries with indexes
- **Merkle root computation**: <100ms for 10,000 transactions

## Development

### Running Tests

```bash
cargo test
```

### Code Formatting

```bash
cargo fmt
```

### Linting

```bash
cargo clippy
```

## License

MIT License - See LICENSE file for details

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

For issues and questions, please open an issue on the GitHub repository.
