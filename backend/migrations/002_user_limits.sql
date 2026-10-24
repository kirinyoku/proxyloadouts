-- 002_user_limits.sql — Custom per-user quotas for builds and teams.
--
-- When NULL, the user falls back to application-wide defaults:
--   MaxBuildsPerAgent = 10
--   MaxTeamsPerAccount = 50
--
-- Custom positive values override the defaults per user.
ALTER TABLE users ADD COLUMN custom_max_builds_per_agent INTEGER CHECK (custom_max_builds_per_agent IS NULL OR custom_max_builds_per_agent > 0);
ALTER TABLE users ADD COLUMN custom_max_teams INTEGER CHECK (custom_max_teams IS NULL OR custom_max_teams > 0);
