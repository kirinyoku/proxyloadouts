SHELL := /bin/bash -o pipefail

# Build variables
BIN_DIR      := bin
SERVER_BIN   := $(BIN_DIR)/server
COVERAGE_OUT := coverage.out
COVERAGE_HTML:= coverage.html
PKG_LIST     := ./...

.PHONY: help dev run build build-prod test test-race test-coverage vet lint lint-fix format tidy check clean codegen

.DEFAULT_GOAL := help

# ------------------------------------------------------------------------------
# Help Screen
# ------------------------------------------------------------------------------
help: ## Display available make commands
	@echo "========================================================================"
	@echo "  ProxyLoadouts Backend — Operational Makefile"
	@echo "========================================================================"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

# ------------------------------------------------------------------------------
# Development
# ------------------------------------------------------------------------------
run: ## Run backend server in development mode (go run ./cmd/server)
	go run ./cmd/server

dev: run ## Alias for run

codegen: ## Generate frontend TypeScript constants from fairy game catalog SDK
	go run ./cmd/codegen

# ------------------------------------------------------------------------------
# Testing & Verification
# ------------------------------------------------------------------------------
test: ## Run unit and integration tests
	go test -v $(PKG_LIST)

test-race: ## Run all tests with Go race detector enabled
	go test -v -race $(PKG_LIST)

test-coverage: ## Run test suite and generate HTML coverage report
	go test -coverprofile=$(COVERAGE_OUT) $(PKG_LIST)
	go tool cover -html=$(COVERAGE_OUT) -o $(COVERAGE_HTML)
	@echo "Coverage report generated: $(COVERAGE_HTML)"

vet: ## Run go vet static analysis
	go vet $(PKG_LIST)

lint: ## Execute golangci-lint with configured project rules (.golangci.yml)
	golangci-lint run $(PKG_LIST)

lint-fix: ## Execute golangci-lint with auto-fix enabled
	golangci-lint run --fix $(PKG_LIST)

format: ## Format Go source code according to gofmt standards
	go fmt $(PKG_LIST)

tidy: ## Clean up and verify go.mod and go.sum dependencies
	go mod tidy

check: test-race lint ## Complete verification: race detector tests and strict linting

# ------------------------------------------------------------------------------
# Build & Distribution
# ------------------------------------------------------------------------------
build: ## Build standard backend binary into bin/server
	mkdir -p $(BIN_DIR)
	go build -o $(SERVER_BIN) ./cmd/server
	@echo "Binary built: $(SERVER_BIN)"

build-prod: ## Build optimized, stripped, static production binary
	mkdir -p $(BIN_DIR)
	CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o $(SERVER_BIN) ./cmd/server
	@echo "Production binary built: $(SERVER_BIN)"

clean: ## Remove build outputs, binaries, and test coverage files
	rm -rf $(BIN_DIR) $(COVERAGE_OUT) $(COVERAGE_HTML)
	@echo "Build artifacts cleaned."
