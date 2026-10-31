CREATE TABLE share_links (
    token_hash BLOB PRIMARY KEY,
    build_id TEXT REFERENCES agent_builds(id) ON DELETE CASCADE,
    account_id TEXT REFERENCES game_accounts(id) ON DELETE CASCADE,
    CHECK ((build_id IS NULL) != (account_id IS NULL))
);
CREATE INDEX idx_share_links_build ON share_links(build_id);
CREATE INDEX idx_share_links_account ON share_links(account_id);
