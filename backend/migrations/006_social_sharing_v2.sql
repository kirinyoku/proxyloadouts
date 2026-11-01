-- 006_social_sharing_v2.sql — Split showcase visibility into roster & teams, default public = 1.

-- 1. Split showcase visibility in game_accounts into roster & teams
ALTER TABLE game_accounts ADD COLUMN is_public_roster INTEGER NOT NULL DEFAULT 1 CHECK (is_public_roster IN (0, 1));
ALTER TABLE game_accounts ADD COLUMN is_public_teams INTEGER NOT NULL DEFAULT 1 CHECK (is_public_teams IN (0, 1));

-- Migrate existing verified accounts' showcase settings
UPDATE game_accounts SET is_public_roster = is_public_showcase, is_public_teams = is_public_showcase;

-- 2. Open builds and teams visibility by default
UPDATE agent_builds SET is_public = 1;
UPDATE teams SET is_public = 1;
