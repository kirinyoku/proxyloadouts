.PHONY: help run dev build build-all test test-frontend test-race test-coverage tidy vet clean dev-frontend build-frontend lint-frontend lint-backend lint sync-static check codegen

.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "PXL (ProxyLoadouts) - Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

codegen: ## Generate frontend game constants from fairy SDK
	cd backend && go run ./cmd/codegen

run: ## Run backend server (go run ./cmd/server)
	cd backend && go run ./cmd/server

dev: run ## Alias for run backend

dev-frontend: ## Run frontend Vite dev server (:5173)
	cd frontend && npm run dev

build: ## Build backend server binary into backend/bin/server
	cd backend && mkdir -p bin && go build -o bin/server ./cmd/server

build-frontend: codegen ## Build frontend SPA into frontend/dist
	cd frontend && npm run build

sync-static: build-frontend ## Build frontend and sync clean assets into backend/internal/adapter/http/static
	rm -rf backend/internal/adapter/http/static/assets backend/internal/adapter/http/static/index.html
	mkdir -p backend/internal/adapter/http/static/assets
	cp -r frontend/dist/* backend/internal/adapter/http/static/

build-all: sync-static build ## Build full standalone binary with embedded frontend

lint-backend: ## Run golangci-lint on backend
	cd backend && golangci-lint run ./...

lint-frontend: ## Run Oxlint on frontend
	cd frontend && npm run lint

lint: lint-backend lint-frontend ## Run all linters (backend & frontend)

test-frontend: ## Run all frontend unit tests (Vitest)
	cd frontend && npm test

test: ## Run all backend tests
	cd backend && go test ./...

test-race: ## Run backend tests with race detector
	cd backend && go test -race ./...

test-coverage: ## Run tests and generate coverage report
	cd backend && go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out -o coverage.html

tidy: ## Tidy Go module dependencies
	cd backend && go mod tidy

vet: ## Run go vet
	cd backend && go vet ./...

check: test-race test-frontend lint-backend lint-frontend build-frontend ## Run all checks (backend race tests & lint, frontend tests & lint & build)

clean: ## Clean build binaries and test coverage files
	rm -rf backend/bin backend/coverage.out backend/coverage.html frontend/dist

