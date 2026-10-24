-- 003_user_moderation.sql — User moderation fields (ban status and reason).
--
-- When banned_at IS NOT NULL, the user is blocked from authenticating or calling
-- protected API endpoints. Banning a user also increments token_version to revoke
-- all existing session cookies immediately.
ALTER TABLE users ADD COLUMN banned_at TEXT;
ALTER TABLE users ADD COLUMN ban_reason TEXT;
