# syntax=docker/dockerfile:1.7
# ==============================================================================
# Multi-stage production build for ProxyLoadouts (Single-Binary Distribution)
# ==============================================================================

# 1. Build frontend React SPA
FROM --platform=$BUILDPLATFORM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --legacy-peer-deps
COPY frontend/ ./
COPY contracts/ ../contracts/

RUN npm run build

# 2. Build Go backend executable with embedded SPA
FROM --platform=$BUILDPLATFORM golang:alpine AS backend-builder
WORKDIR /app
RUN apk add --no-cache git ca-certificates tzdata

COPY backend/go.mod backend/go.sum ./backend/
RUN --mount=type=cache,target=/go/pkg/mod/ \
    cd backend && go mod download

COPY backend/ ./backend/
# Copy built SPA directly into the embed directory
COPY --from=frontend-builder /app/frontend/dist/ ./backend/internal/adapter/http/static/

ARG TARGETOS
ARG TARGETARCH
ARG GIT_SHA="prod"
RUN --mount=type=cache,target=/go/pkg/mod/ \
    --mount=type=cache,target=/root/.cache/go-build \
    cd backend && CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64} go build -trimpath -ldflags="-s -w -X main.gitSha=${GIT_SHA}" -o /bin/proxyloadouts ./cmd/server

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
