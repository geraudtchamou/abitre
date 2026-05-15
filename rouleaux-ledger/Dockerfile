FROM rust:1.75-slim-bookworm as builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency definitions
COPY Cargo.toml ./
COPY src/ ./src/
COPY migrations/ ./migrations/

# Create dummy files for build caching
RUN mkdir -p src && \
    echo "fn main() {}" > src/main.rs || true

# Build dependencies (this step is cached if Cargo.toml doesn't change)
RUN cargo build --release 2>/dev/null || true

# Remove dummy files and restore actual source
RUN rm -rf src && \
    mkdir -p src
COPY src/ ./src/
COPY migrations/ ./migrations/

# Build the actual application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    libssl3 \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -r -u 1000 -g root rouleaux

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/target/release/rouleaux-ledger .

# Set ownership
RUN chown -R rouleaux:root /app

USER rouleaux

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Run the application
CMD ["./rouleaux-ledger"]
