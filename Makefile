.DEFAULT_GOAL := help
GIT_SHA ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo prod)
.PHONY: help \
	dev-backend dev-frontend dev run \
	codegen \
	test test-backend test-frontend \
	lint lint-contracts lint-backend lint-frontend \
	build build-all \
	check clean \
	docker-build docker-up docker-down docker-logs

help: ## Show this help message
	@echo "ProxyLoadouts (PXL) - Monorepo Orchestration"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

# ==============================================================================
# Development
# ==============================================================================

dev-backend: ## Run Go backend API server (:8080)
	go -C backend run -ldflags="-X main.gitSha=$(GIT_SHA)" ./cmd/server

dev-frontend: ## Run Vite frontend dev server with HMR (:5173)
	npm --prefix frontend run dev

# Aliases for convenience
dev: dev-backend
run: dev-backend

# ==============================================================================
# Codegen & Contract Management
# ==============================================================================

codegen: ## Generate OpenAPI TS types and game constants
	npm --prefix frontend run codegen:api
	go -C backend run ./cmd/codegen

# ==============================================================================
# Testing & Quality Assurance
# ==============================================================================

test-backend: ## Run backend unit & integration tests (-race)
	go -C backend test -race ./...

test-frontend: ## Run frontend unit and component tests (Vitest)
	npm --prefix frontend test

test: test-backend test-frontend ## Run all test suites (backend -race + frontend Vitest)

# ==============================================================================
# Code Quality & Linting
# ==============================================================================

lint-contracts: ## Validate OpenAPI 3.1 specification with Redocly
	npm --prefix frontend run lint:contracts

lint-backend: ## Run golangci-lint on Go backend
	cd backend && golangci-lint run ./...

lint-frontend: ## Run oxlint on frontend
	npm --prefix frontend run lint

lint: lint-contracts lint-backend lint-frontend ## Run all linters (contracts, backend, frontend)

# ==============================================================================
# Build & Distribution
# ==============================================================================

build: codegen ## Build standalone single-binary with embedded frontend (backend/bin/server)
	npm --prefix frontend run build
	rm -rf backend/internal/adapter/http/static/assets
	cp -r frontend/dist/* backend/internal/adapter/http/static/
	go -C backend build -trimpath -ldflags="-s -w -X main.gitSha=$(GIT_SHA)" -o bin/server ./cmd/server

build-all: build

# ==============================================================================
# Continuous Integration & Cleanup
# ==============================================================================

check: lint test build ## Run full CI-parity verification suite (lint, test, build)

clean: ## Clean build artifacts, temporary reports, and test caches
	rm -rf backend/bin backend/coverage.* frontend/dist

# ==============================================================================
# Docker & Deployment
# ==============================================================================

COMPOSE_FILE := deploy/docker-compose.yml
COMPOSE_OVERRIDE := $(wildcard deploy/docker-compose.override.yml)
COMPOSE_FLAGS := -f $(COMPOSE_FILE) $(if $(COMPOSE_OVERRIDE),-f $(COMPOSE_OVERRIDE))

docker-build: ## Build production Docker image (proxyloadouts:latest)
	docker build --build-arg GIT_SHA=$(GIT_SHA) -t proxyloadouts:latest .

docker-up: ## Start full stack (app + Dozzle logs) in background via Compose
	GIT_SHA=$(GIT_SHA) docker compose $(COMPOSE_FLAGS) up -d --build

docker-down: ## Stop and remove Compose containers
	docker compose $(COMPOSE_FLAGS) down

docker-logs: ## Follow live logs from Compose services
	docker compose $(COMPOSE_FLAGS) logs -f
