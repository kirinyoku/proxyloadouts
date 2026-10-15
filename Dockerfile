# ==============================================================================
# Multi-stage production build for ProxyLoadouts (Single-Binary Distribution)
# ==============================================================================

# 1. Build frontend React SPA
FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci --legacy-peer-deps
COPY frontend/ ./
COPY contracts/ ../contracts/

ARG VITE_SENTRY_DSN=""
ENV VITE_SENTRY_DSN=$VITE_SENTRY_DSN
RUN npm run build

# 2. Build Go backend executable with embedded SPA
FROM golang:alpine AS backend-builder
WORKDIR /app
RUN apk add --no-cache git ca-certificates tzdata

COPY backend/go.mod backend/go.sum ./backend/
RUN cd backend && go mod download

COPY backend/ ./backend/
# Copy built SPA directly into the embed directory
COPY --from=frontend-builder /app/frontend/dist/ ./backend/internal/adapter/http/static/

ARG GIT_SHA="prod"
RUN cd backend && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -X main.gitSha=${GIT_SHA}" -o /bin/proxyloadouts ./cmd/server

# 3. Minimal production runner
FROM alpine:3.21
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata && \
    addgroup -g 1001 appgroup && \
    adduser -u 1001 -G appgroup -s /bin/sh -D appuser && \
    mkdir -p /app/data && chown -R appuser:appgroup /app/data

COPY --from=backend-builder /bin/proxyloadouts /app/proxyloadouts

USER appuser
EXPOSE 8080
VOLUME ["/app/data"]

ENTRYPOINT ["/app/proxyloadouts"]
