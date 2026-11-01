-- 005_social_sharing.sql — UID verification, public showcase & build/team sharing.

-- 1. Расширение game_accounts метаданными витрины и верификации
ALTER TABLE game_accounts ADD COLUMN nickname TEXT;
ALTER TABLE game_accounts ADD COLUMN avatar_url TEXT;
ALTER TABLE game_accounts ADD COLUMN verified_at TEXT;
ALTER TABLE game_accounts ADD COLUMN is_public_showcase INTEGER NOT NULL DEFAULT 0 CHECK (is_public_showcase IN (0, 1));
ALTER TABLE game_accounts ADD COLUMN show_discord INTEGER NOT NULL DEFAULT 0 CHECK (show_discord IN (0, 1));

-- Гарантия на уровне движка SQLite: у одного UID может быть максимум ОДИН верифицированный владелец
CREATE UNIQUE INDEX IF NOT EXISTS idx_game_accounts_verified_uid
ON game_accounts(uid)
WHERE verified_at IS NOT NULL;

-- 2. Индивидуальные флаги публичности для билдов и отрядов
ALTER TABLE agent_builds ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1));
ALTER TABLE teams ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1));

-- Индексы для мгновенной выборки публичного контента витрины
CREATE INDEX IF NOT EXISTS idx_agent_builds_public_account
ON agent_builds(game_account_id, agent_id)
WHERE is_public = 1;

CREATE INDEX IF NOT EXISTS idx_teams_public_account
ON teams(game_account_id)
WHERE is_public = 1;
