CREATE TABLE fae_profiles (
 uid TEXT PRIMARY KEY,
 current_observation TEXT,
 history TEXT NOT NULL DEFAULT '[]',
 refresh_available_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE INDEX fae_profiles_eviction ON fae_profiles(updated_at);
CREATE TABLE fae_host_policy (
 id INTEGER PRIMARY KEY CHECK (id = 1),
 backoff_until INTEGER NOT NULL DEFAULT 0
);
INSERT INTO fae_host_policy(id) VALUES (1);
