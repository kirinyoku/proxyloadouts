-- 004_user_custom_accounts.sql — Custom per-user quota for linked game accounts (ZZZ UIDs).
--
-- When NULL, the user falls back to application-wide default:
--   MaxAccountsPerUser = 3
--
-- Custom positive values override the default per user.
ALTER TABLE users ADD COLUMN custom_max_accounts INTEGER CHECK (custom_max_accounts IS NULL OR custom_max_accounts > 0);
