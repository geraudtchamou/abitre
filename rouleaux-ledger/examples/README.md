# Rouleaux Ledger Client Examples

This directory contains example code for interacting with the Rouleaux Ledger API from various programming languages.

## Files

- `client_examples.rs` - Rust example with comprehensive documentation for multiple languages

## Quick Start Examples

### cURL

```bash
# Health check
curl http://localhost:3001/health

# Create transaction
curl -X POST http://localhost:3001/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_123",
    "transaction_type": "payment",
    "amount": 10000,
    "currency": "USD",
    "description": "Payment for services",
    "signature": "sig_abc123"
  }'
```

### JavaScript (Node.js)

```javascript
const axios = require('axios');

const client = axios.create({ baseURL: 'http://localhost:3001' });

// Create transaction
const tx = await client.post('/transactions', {
  user_id: 'user_123',
  transaction_type: 'payment',
  amount: 10000,
  currency: 'USD',
  description: 'Payment',
  signature: 'sig_abc123'
});

// Query transactions
const results = await client.get('/transactions', {
  params: { user_id: 'user_123', limit: 10 }
});
```

### Python

```python
import requests

client = requests.Session()
base_url = "http://localhost:3001"

# Create transaction
tx = client.post(f"{base_url}/transactions", json={
    "user_id": "user_123",
    "transaction_type": "payment",
    "amount": 10000,
    "currency": "USD",
    "description": "Payment",
    "signature": "sig_abc123"
})

# Query transactions
results = client.get(f"{base_url}/transactions", params={
    "user_id": "user_123",
    "limit": 10
})
```

See `client_examples.rs` for complete examples in all supported languages.
