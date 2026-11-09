# ProxyLoadouts — Backend Core Engine

[![Go Version](https://img.shields.io/badge/Go-1.26+-00ADD8?style=flat&logo=go)](https://go.dev/)
[![Architecture](https://img.shields.io/badge/Architecture-Hexagonal%20%2F%20Clean-blue)](https://en.wikipedia.org/wiki/Hexagonal_architecture_(software))
[![Storage](https://img.shields.io/badge/Storage-SQLite%20WAL%20(Pure--Go)-003B57?logo=sqlite)](https://sqlite.org/)
[![API Contract](https://img.shields.io/badge/Contract-OpenAPI%203.1-6BA539?logo=openapiinitiative)](../contracts/openapi.yaml)
[![Tests](https://img.shields.io/badge/Tests-Passing%20with%20--race-success)](Makefile)
[![Linter](https://img.shields.io/badge/Linter-golangci--lint%20(strict)-brightgreen)](.golangci.yml)

The backend service for **ProxyLoadouts (PXL)** is a low-latency Go 1.26 application that powers *Zenless Zone Zero* showcase synchronization (via EnkaNetwork & Fairy SDK), community build ratings and leaderboard rankings (via ZFAE), persistent agent equipment presets (W-Engines & Drive Discs), and 3-agent squad assembly with transactional gear conflict validation.

It can run either as a standalone REST API server during local development or as a **self-contained single binary** (`CGO_ENABLED=0`, ~35 MB RAM) with the React 19 SPA embedded directly via `//go:embed`.

[**Root Project Overview**](../README.md) · [**Frontend & UI/UX Showcase**](../frontend/README.md) · [**OpenAPI 3.1 Contract**](../contracts/openapi.yaml)

---

## Table of Contents

1. [Architectural Overview (Hexagonal / Ports & Adapters)](#architectural-overview)
2. [Key Engineering Decisions & Trade-Offs](#key-engineering-decisions--trade-offs)
   - [Storage Engine: Pure-Go SQLite in WAL Mode](#1-storage-engine-pure-go-sqlite-in-wal-mode)
   - [External Dependency Resilience & Thundering Herd Defense](#2-external-dependency-resilience--thundering-herd-defense)
   - [In-Memory Conflict Detection Engine](#3-in-memory-conflict-detection-engine)
   - [Stateless AES-GCM Sessions with Instant Revocation](#4-stateless-aes-gcm-sessions-with-instant-revocation)
   - [Origin & CSRF Defense Architecture](#5-origin--csrf-defense-architecture)
   - [Graceful Lifecycle & Zero-Downtime Draining](#6-graceful-lifecycle--zero-downtime-draining)
   - [Cryptographic Share Links & Zero-Trust Storage](#7-cryptographic-share-links--zero-trust-storage)
3. [Contract-First Governance & Codegen](#contract-first-governance--codegen)
4. [Database Schema & Migrations](#database-schema--migrations)
5. [Service Setup & Execution Modes](#service-setup--execution-modes)
6. [Operational Tooling & Makefile](#operational-tooling--makefile)

---

## Architectural Overview

The backend strictly adheres to **Clean Architecture / Hexagonal Architecture** (Ports and Adapters) principles. Business domain rules are encapsulated at the core and have zero dependencies on external frameworks, database drivers, or transport layers.

```mermaid
flowchart TD
    %% Classes & Styling
    classDef driving fill:#e1f5fe,stroke:#0288d1,stroke-width:1.5px,color:#01579b;
    classDef app fill:#e8f5e9,stroke:#2e7d32,stroke-width:1.5px,color:#1b5e20;
    classDef domain fill:#fff3e0,stroke:#ef6c00,stroke-width:1.5px,color:#e65100;
    classDef port fill:#f3e5f5,stroke:#7b1fa2,stroke-width:1.5px,stroke-dasharray: 4 2,color:#4a148c;
    classDef driven fill:#eceff1,stroke:#455a64,stroke-width:1.5px,color:#263238;

    subgraph Driving["Driving Adapters (Inbound)"]
        HTTP["HTTP API & SPA Server<br/>(Chi v5 + embed.FS)"]:::driving
    end

    subgraph Application["Application Layer (Use Cases)"]
        direction TB
        AuthSvc["authsvc (Discord Auth & Sessions)"]:::app
        BuildSvc["buildsvc (Agent Builds CRUD)"]:::app
        TeamSvc["teamsvc (Squad Assembly)"]:::app
        ScannerSvc["scannersvc (Enka Showcase Sync)"]:::app
        AccountSvc["accountsvc (Game Accounts)"]:::app
        BuildEnrich["buildenrich (Singleflight Localizer)"]:::app
    end

    subgraph Domain["Domain Core (Invariants & Ports)"]
        direction TB
        Entities["Domain Entities (Account, Build, Team, User)"]:::domain
        ConflictEngine["Conflict Engine (conflicts.Validate)"]:::domain
        RepoPorts["Repository Ports (domain.*Repository)"]:::port
        OAuthPort["OAuth Port (authsvc.DiscordClient)"]:::port
        ScannerPort["Fetcher Port (scannersvc.Fetcher)"]:::port
    end

    subgraph Driven["Driven Adapters (Outbound)"]
        direction LR
        SQLite[("SQLite WAL (modernc.org/sqlite)")]:::driven
        Discord["Discord API (OAuth2 Client)"]:::driven
        Fairy["Fairy & Enka SDK (Game Catalog)"]:::driven
        ZFAE["ZFAE (zfae.net Ratings)"]:::driven
        Cache["In-Memory Cache (LRU + Singleflight)"]:::driven
    end

    %% Inbound Flow
    Driving -->|"Dispatches requests"| Application

    %% Core Dependencies & Flow
    Application -->|"Domain logic"| Domain

    %% Dependency Inversion: Adapters implement Ports
    RepoPorts <-.-|"Implements"| SQLite
    OAuthPort <-.-|"Implements"| Discord
    ScannerPort <-.-|"Implements"| Fairy
    Application -.->|"Live ratings"| ZFAE
    Application -.->|"In-memory Cache"| Cache
```

### Directory Taxonomy

```
backend/
├── cmd/
│   ├── server/             # Runtime composition root, dependency injection & signal handling
│   ├── codegen/            # CLI codegen deriving TypeScript game constants from Fairy SDK
│   └── userquota/          # CLI management tool for inspecting and adjusting user build/team quotas
├── internal/
│   ├── domain/             # Pure entities, domain invariants, custom errors, repository ports
│   ├── engine/
│   │   └── conflicts/      # In-memory Conflict Detection Engine (slot and gear uniqueness)
│   ├── app/                # Orchestration use cases (transaction boundaries, caching workflows)
│   │   ├── accountsvc/     # Game account (UID) association & auto-region detection
│   │   ├── authsvc/        # Discord OAuth2 identity, AES-GCM session cryptography
│   │   ├── buildenrich/    # Localized build snapshot enrichment with singleflight caching
│   │   ├── buildsvc/       # Agent build lifecycle, validation, and quota enforcement
│   │   ├── scannersvc/     # Upstream showcase fetching, TTL & negative caching
│   │   └── teamsvc/        # 3-agent team assembly & transactional conflict validation
│   ├── adapter/            # Concrete implementations of driving & driven ports
│   │   ├── http/           # Chi v5 router, middleware pipeline, REST handlers, static SPA handler
│   │   ├── sqlite/         # CGO-free modernc SQLite driver, WAL pool, and migrator
│   │   ├── discord/        # Discord OAuth2 HTTP client
│   │   ├── fairy/          # ZZZ game catalog SDK adapter (github.com/kirinyoku/fairy)
│   │   ├── inmemory/       # Thread-safe generic LRU TTL cache, negative cache & singleflight
│   │   ├── telegram/       # Async deduplicating Telegram Bot API alert notifier
│   │   └── zfae/           # ZFAE (zfae.net) scraper adapter for build ratings and leaderboards
│   └── config/             # Typed environment parsing with production validation guards
└── migrations/             # Embedded SQL schema migrations (embed.FS)
```

---

## Key Engineering Decisions & Trade-Offs

### 1. Storage Engine: Pure-Go SQLite in WAL Mode

**Decision**: Use `modernc.org/sqlite` instead of PostgreSQL or external DBMS services.

- **Why**: ProxyLoadouts is engineered for minimal operational overhead and a tiny resource footprint (~35 MB RAM in production). Embedded SQLite in WAL mode handles read-heavy loadout and squad queries with sub-millisecond latency on a single VPS without maintaining a separate PostgreSQL container.
- **Pure-Go (CGO-Free)**: Eliminates C-compiler dependencies, enabling fast static builds (`CGO_ENABLED=0`) for minimal Alpine/Linux containers.
- **Concurrency & WAL Configuration**: SQLite defaults to rollback journal locking. At startup (`internal/adapter/sqlite/db.go`), the engine explicitly sets:
  ```sql
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  PRAGMA foreign_keys = ON;
  PRAGMA synchronous = NORMAL;
  ```
  - **WAL (Write-Ahead Logging)** allows multiple concurrent readers to proceed without blocking writers, and writers do not block readers.
  - `busy_timeout = 5000ms` provides graceful waiting during brief lock acquisitions, completely eliminating transient `database is locked` errors.
  - Open connections are strictly bounded (`MaxOpenConns = 1` for the write pool or controlled pool allocation) to guarantee transactional integrity.

### 2. External Dependency Resilience & Thundering Herd Defense

**Decision**: Implement a multi-tier caching and coalescing pipeline in front of upstream integrations (EnkaNetwork, Fairy SDK, and ZFAE).

Upstream game profile and build rating queries are subject to network variance and rate limits. A sudden traffic spike for a popular player UID could cause cascading 429 errors.

1. **Request Coalescing (`singleflight`)**:
   When 20 concurrent HTTP requests arrive for the same uncached player UID, `golang.org/x/sync/singleflight` ensures only **one** outbound request hits the upstream API. The remaining 19 goroutines wait and share the single result.
2. **Two-Tier In-Memory Caching**:
   - **Positive LRU Cache**: Successful profile responses are held in memory with upstream-declared TTL (default 5 min).
   - **Negative Cache**: Requests for private or missing showcases (404 / empty) are cached for 60 seconds with strict capacity bounds. This prevents malicious actors from exhausting upstream quotas with invalid UIDs.
3. **Heavy Computation Memoization (`buildenrich`)**:
   Rebuilding localized gear statistics from raw binary snapshots is CPU-intensive. The `buildenrich` service wraps the localizer in a singleflight memoization store (`BUILD_ENRICH_CACHE_MAX_ITEMS=2000`, TTL 15m), serving repeated queries directly from RAM.
4. **Token-Bucket Rate Limiter**:
   Public showcase endpoints are guarded by an in-memory IP-based token-bucket rate limiter (`golang.org/x/time/rate`), configurable via environment variables.

### 3. In-Memory Conflict Detection Engine

**Decision**: Execute team equipment conflict checks entirely in memory (`internal/engine/conflicts/validator.go`) without database joins.

- **The Problem**: A 3-member ZZZ squad cannot equip duplicate Drive Discs (partitioned into slots 1 through 6) or duplicate W-Engines across active agents.
- **The Solution**: An isolated, pure algorithmic engine. Given 1 to 3 builds, it validates:
  1. No duplicate agent IDs.
  2. No duplicate W-Engine string UIDs.
  3. No duplicate Drive Disc string UIDs across all slots.
  4. All builds belong to the same game account.
- **Time Complexity**: Evaluates all constraints in $O(N \cdot M)$ time ($N \le 3$ agents, $M \le 7$ equipment pieces per agent), executing in $< 5\mu s$. This enables real-time client validation and transactional database checks upon team saving.

### 4. Stateless AES-GCM Sessions with Instant Revocation

**Decision**: Use encrypted, tamper-proof session cookies instead of server-side Redis session stores.

- **Security**: The session payload contains the authenticated user ID and a cryptographic nonce. The cookie is encrypted and authenticated using **AES-256-GCM** with a server-side `SESSION_SECRET`.
- **The Invalidation Challenge**: Stateless cookies normally cannot be revoked until expiry.
- **Solution (Token Versioning)**: Every user record maintains a `token_version INT DEFAULT 1` in SQLite. When a user logs out (`POST /api/v1/auth/logout`), the server increments `token_version`, immediately invalidating any previously issued cookie presenting an older version (`401 Unauthorized`). Full account deletion (`DELETE /api/v1/auth/me`) permanently removes the user row and cascades across all linked accounts, builds, and squads.

### 5. Origin & CSRF Defense Architecture

**Decision**: Multi-layered defense-in-depth on all mutating HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`).

1. **Origin / Referer Strict Allowlisting**: The middleware compares incoming `Origin` and `Referer` headers against `FRONTEND_URL`. Requests originating from unauthorized third-party domains are immediately dropped with `403 Forbidden`.
2. **Dual-Header Verification**: API requests without Origin headers (e.g. mobile/desktop webviews) are accepted only if they carry custom headers `X-Requested-With: XMLHttpRequest` or `X-CSRF-Token`, which cannot be forged in cross-site browser form submissions.
3. **Defense HTTP Headers**:
   - `X-Content-Type-Options: nosniff`
   - `X-Frame-Options: DENY` (Clickjacking prevention)
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `Strict-Transport-Security` (automatically activated in `ENV=production`)

### 6. Graceful Lifecycle & Zero-Downtime Draining

**Decision**: Proper POSIX signal trapping and bounded connection draining (`cmd/server/main.go`).

- Upon receiving `SIGTERM` or `SIGINT`, the server stops accepting new connections and gives active in-flight HTTP requests up to **10 seconds** to complete.
- Background cache cleanup goroutines (`inmemory.Cache.Close()`) and rate limiter sweepers are stopped via structured `defer` chains.
- The SQLite database handle is closed only after all active HTTP handlers have returned, preventing WAL truncation corruption.

### 7. Cryptographic Share Links & Zero-Trust Storage

**Decision**: Store SHA-256 token hashes (`token_hash BLOB PRIMARY KEY`) instead of plaintext URL tokens.

- **The Security Challenge**: Public share URLs (`/b/:token`, `/t/:token`, `/r/:token`) contain unguessable high-entropy tokens. If raw tokens were stored directly in SQLite, an unauthorized database backup read would compromise every active secret link.
- **Hash-At-Rest Storage**: When a user generates a share link, the raw token is returned to the client once. The database stores only `token_hash BLOB PRIMARY KEY` (computed via SHA-256). Incoming resolution requests hash the URL parameter and look up the binary digest in $O(1)$ time.
- **Polymorphic Integrity & Cascading Lifecycle**:
  The `share_links` table enforces a polymorphic exclusive relationship across builds, teams, and accounts:
  ```sql
  CHECK (
      (CASE WHEN build_id IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN account_id IS NOT NULL THEN 1 ELSE 0 END +
       CASE WHEN team_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
  ```
  Foreign keys configure `ON DELETE CASCADE`: deleting a build, team, or account atomically purges all associated share links without dangling pointer bugs.

---

## Contract-First Governance & Codegen

The API strictly implements the OpenAPI 3.1 specification located at [`contracts/openapi.yaml`](../contracts/openapi.yaml).

### Code Generation Pipeline (`cmd/codegen`)
To eliminate manual duplication between Go game catalog logic and frontend TypeScript types:
- `backend/cmd/codegen/main.go` directly inspects the `github.com/kirinyoku/fairy` game data SDK.
- It automatically generates `frontend/src/lib/game-constants.generated.ts` with agent metadata, combat attributes, specialty mappings, and drive disc catalog definitions.
- Triggered seamlessly via:
  ```bash
  make codegen
  ```

---

## Database Schema & Migrations

Database evolution is managed via versioned SQL migrations embedded directly into the Go binary (`migrations/embed.go`):

| Migration | Scope | Key Relational Invariants |
|---|---|---|
| `001_init.sql` | Core Schema | • UUIDv4 surrogate primary keys across all tables.<br>• Discord identity uniqueness and account cascading (`ON DELETE CASCADE`).<br>• Session revocation via atomic `token_version INT NOT NULL DEFAULT 1`.<br>• Fast conflict indexing with `disc_slots JSON` and indexed lookup columns.<br>• Upstream payload integrity with immutable `raw_data TEXT NOT NULL`.<br>• Team slot bounds (`CHECK (slot_number BETWEEN 1 AND 3)`) and deletion guards (`ON DELETE RESTRICT` for active squad builds). |
| `002_user_limits.sql` | Quota Controls | • Configurable per-user quota ceilings (`max_accounts`, `max_builds_per_agent`, `max_teams`). |
| `003_user_moderation.sql` | Moderation & Bans | • Account suspension via `banned_at` audit timestamp, preventing abuse and invalidating stale tokens. |
| `004_user_custom_accounts.sql` | Account Overrides | • Granular per-user overrides for maximum linked game accounts. |
| `005_social_sharing.sql` | Public Showcases | • UID ownership verification (`verified_at`) with partial unique index (`idx_game_accounts_verified_uid`).<br>• Public showcase controls (`is_public_showcase`, `show_discord`) and per-build/team visibility flags. |
| `006_social_sharing_v2.sql` | Sharing Indexes | • Performance indexes for public account rosters and squads (`WHERE is_public = 1`). |
| `007_share_links.sql` | Secret Tokens | • High-entropy secret share links with `token_hash BLOB PRIMARY KEY` (SHA-256 at rest) for builds and accounts. |
| `008_share_links_teams.sql` | Squad Sharing | • Extended polymorphic sharing covering 3-agent squads (`team_id`) with exclusive relation check and `kind` classification. |

Migrations execute automatically at application boot inside a transaction, recording applied versions in the `schema_migrations` audit table. Subsequent schema changes post-release follow strict sequential versioning (`002_...`, `003_...`).

---

## Service Setup & Execution Modes

The backend service is designed for deterministic execution across development workstations and production infrastructure. Configuration is resolved via environment variables and local `.env` files using `internal/config`.

### 1. Prerequisites

- **Go Toolchain**: Go 1.26 or higher. The codebase relies purely on Go (`CGO_ENABLED=0`), eliminating external C runtime headers or toolchain dependencies.
- **Static Analysis**: `golangci-lint` (v1.60+) for pre-commit verification against configured rulesets.

### 2. Configuration Parameters & Subsystem Boundaries

Initialize the local configuration file:
```bash
cp .env.example .env
```

Configuration variables control specific subsystem boundaries:

| Parameter | Boundary / Subsystem | Purpose & Operational Role |
|---|---|---|
| `ENV` | System Context | Controls security policy mode (`development` vs `production`). In production, triggers strict boot-time credential assertion. |
| `PORT` | Transport Layer | HTTP listener TCP port (defaults to `8080`). |
| `DATABASE_PATH` | Storage Engine | Absolute or relative filesystem path to the SQLite database. Parent directories and WAL auxiliary files are created automatically. |
| `FRONTEND_URL` | Network Boundary | Origin of the frontend application. Governs CORS allowlists, OAuth redirect destinations, and CSRF Origin/Referer header enforcement. |
| `SESSION_SECRET` | Cryptographic Core | Symmetric key used to encrypt and authenticate HTTP-only session cookies with AES-256-GCM. In production, must be at least 32 high-entropy bytes (`openssl rand -hex 32`). |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` | Identity Provider | Discord OAuth2 application credentials used to authenticate user sessions and synchronize identity profiles. |
| `DISCORD_REDIRECT_URI` | Identity Provider | Registered OAuth2 callback endpoint matching the domain topology. |
| `ENKA_TIMEOUT` | Upstream Client | Maximum HTTP timeout (seconds) when fetching character showcase snapshots from upstream EnkaNetwork API. |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` | Observability & Alerting | Optional Telegram Bot API credentials for asynchronous, deduplicated error, panic, and lifecycle notifications. |

> Additional operational parameters governing LRU cache quotas, token-bucket rate limits, and `singleflight` TTL horizons are documented directly in [`.env.example`](.env.example).

---

### 3. Execution Modes

The application distinguishes between two primary operational profiles:

#### Local Development Profile (`ENV=development`)

Designed for local development and rapid iteration:

1. **Start the HTTP Server**:
   ```bash
   make run
   # Alternatively: go run ./cmd/server
   ```
2. **Behavioral Invariants in Development**:
   - **Optional Discord Credentials on Boot**: If `DISCORD_CLIENT_ID` or `DISCORD_CLIENT_SECRET` are unset, the server logs a warning via `slog.Warn` and boots cleanly so public endpoints (`/api/v1/showcase/{uid}`, `/health`) work immediately. Authenticated flows (`Roster`, `Squads`, `Settings`) require configuring Discord OAuth2 dev credentials in `.env`.
   - **Relaxed Cookie Flags**: Cookies permit plain HTTP connections over `localhost`.
   - **Verbose Structured Logging**: `slog` outputs human-readable runtime states.
3. **Healthcheck Verification**:
   ```bash
   curl -s http://localhost:8080/health
   # Output: {"status":"ok"}
   ```

#### Production Profile (`ENV=production`)

Designed for hardened production deployments and container environments:

1. **Compilation**:
   Compile a stripped, statically linked binary with compiler inlining and symbol stripping:
   ```bash
   make build-prod
   ```
   This generates `bin/server` with `CGO_ENABLED=0 -trimpath -ldflags="-s -w"`.
2. **Behavioral Invariants in Production**:
   - **Mandatory Credential Assertion**: `cfg.ValidateProduction()` verifies that `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and a non-default `SESSION_SECRET` are present. If any required secret is missing or set to a placeholder, the binary refuses to start and terminates with a fatal exit code.
   - **Strict Transport Security**: Cookies automatically mandate the `Secure` flag, preventing transmission over unencrypted channels.
   - **Signal Handling & Graceful Termination**: Integrates with container orchestrators (Docker, Kubernetes) and `systemd`. Upon receiving `SIGTERM` or `SIGINT`, the server executes a 10-second bounded drain phase:
     1. Closes listener sockets to stop receiving new connections.
     2. Awaits completion of in-flight HTTP requests and pending database transactions.
     3. Closes background singleflight worker routines and cache stores.
     4. Safely flushes and closes the SQLite WAL database.
     5. Exits cleanly with status code `0`.

---

## Operational Tooling & Makefile

The backend includes a self-documenting operational Makefile:

```bash
# Display help and target catalog
make help

# Run development server (go run ./cmd/server)
make run

# Run full test suite with Go Race Detector
make test-race

# Run test coverage and generate interactive HTML report
make test-coverage

# Run strict golangci-lint (configured via .golangci.yml)
make lint

# Auto-fix linting issues where supported
make lint-fix

# Complete quality gate (race tests + strict lint)
make check

# Build optimized, stripped, static production binary
make build-prod

# Regenerate frontend TypeScript constants from Fairy SDK
make codegen

# Clean build artifacts and coverage files
make clean
```
