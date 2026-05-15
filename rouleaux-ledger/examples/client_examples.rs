//! Rouleaux Ledger - Client Library Examples
//! 
//! This file demonstrates how to interact with the Rouleaux Ledger API
//! from various programming languages and frameworks.

fn main() {
    println!("Rouleaux Ledger Client Examples");
    println!("================================");
    println!();
    println!("See documentation for client examples in:");
    println!("  - Rust (async/await with reqwest)");
    println!("  - JavaScript/Node.js (axios)");
    println!("  - Python (requests)");
    println!("  - cURL commands");
    println!();
    println!("API Endpoints:");
    println!("  GET  /health           - Health check");
    println!("  GET  /stats            - Ledger statistics");
    println!("  POST /transactions     - Create transaction");
    println!("  GET  /transactions     - Query transactions");
    println!("  GET  /transactions/:hash - Get by hash");
    println!("  GET  /transactions/verify - Verify chain");
    println!("  GET  /merkle-root      - Get Merkle root");
    println!();
    println!("Default URL: http://localhost:3001");
}
