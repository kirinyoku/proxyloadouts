-- 001_init.sql — Initial ProxyLoadouts schema.
--
-- Connection-level PRAGMAs (foreign_keys = ON, journal_mode = WAL, busy_timeout = 5000)
-- are applied by internal/adapter/sqlite/db.go at startup.

-- 1. Users (Discord OAuth2 identity)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                       -- UUID v4
    discord_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    avatar_url TEXT,
    token_version INTEGER NOT NULL DEFAULT 1,  -- Incremented on global logout for instant session revocation
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Game accounts (ZZZ UID)
CREATE TABLE IF NOT EXISTS game_accounts (
    id TEXT PRIMARY KEY,                       -- UUID v4
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    uid TEXT NOT NULL,
    region TEXT NOT NULL DEFAULT 'Europe',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, uid)
);

CREATE INDEX IF NOT EXISTS idx_game_accounts_user ON game_accounts(user_id);

-- 3. Saved agent builds
CREATE TABLE IF NOT EXISTS agent_builds (
    id TEXT PRIMARY KEY,                       -- UUID v4
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_account_id TEXT NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,

    agent_id INTEGER NOT NULL,                 -- Agent ID from fairy catalog (e.g. 1511)
    agent_name TEXT NOT NULL,                  -- Localized name (e.g. Miyabi)
    name TEXT NOT NULL,                        -- Preset name ("Anomaly Main")
    description TEXT,                          -- Optional user notes

    -- Fast lookup fields for the Conflict Engine
    weapon_uid TEXT,                           -- String UID of the W-Engine
    weapon_id INTEGER,                         -- Weapon ID from the catalog
    disc_uids TEXT NOT NULL DEFAULT '[]',      -- JSON array of string disc UIDs: ["uid1", "uid2", ...]
    disc_slots TEXT NOT NULL DEFAULT '{}',     -- JSON map of slot -> disc UID: {"1": "uid1", ...}

    -- Pristine upstream Enka snapshot for dynamic localization
    raw_data TEXT NOT NULL,                    -- JSON object

    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_agent_builds_account_agent ON agent_builds(game_account_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_builds_user ON agent_builds(user_id);

-- 4. Teams
CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,                       -- UUID v4
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    game_account_id TEXT NOT NULL REFERENCES game_accounts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_teams_account ON teams(game_account_id);

-- 5. Team slots (up to 3 members)
CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,                       -- UUID v4
    team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    slot_number INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 3),
    build_id TEXT NOT NULL REFERENCES agent_builds(id) ON DELETE RESTRICT,
    UNIQUE(team_id, slot_number)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_build ON team_members(build_id);
