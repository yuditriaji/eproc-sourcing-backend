# Multi-stage build for Go application
FROM golang:1.21-alpine AS builder

# Set working directory
WORKDIR /app

# Install dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o scoring-service .

# Production stage
FROM alpine:latest AS production

# Install ca-certificates for HTTPS requests and curl for health checks
RUN apk --no-cache add ca-certificates curl

# Create non-root user for security
RUN addgroup -g 1001 -S appgroup
RUN adduser -S appuser -u 1001 -G appgroup

# Set working directory
WORKDIR /root/

# Copy built binary from builder stage
COPY --from=builder /app/scoring-service .

# Change ownership to non-root user
RUN chown appuser:appgroup scoring-service

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:9090/health || exit 1

# Start the application
CMD ["./scoring-service"]