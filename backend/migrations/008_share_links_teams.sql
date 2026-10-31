CREATE TABLE share_links_new (
    token_hash BLOB PRIMARY KEY,
    build_id TEXT REFERENCES agent_builds(id) ON DELETE CASCADE,
    account_id TEXT REFERENCES game_accounts(id) ON DELETE CASCADE,
    team_id TEXT REFERENCES teams(id) ON DELETE CASCADE,
    kind TEXT NOT NULL DEFAULT 'default' CHECK (kind IN ('default', 'squads')),
    CHECK (
        (CASE WHEN build_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN account_id IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN team_id IS NOT NULL THEN 1 ELSE 0 END) = 1
    )
);

INSERT INTO share_links_new (token_hash, build_id, account_id, kind)
SELECT token_hash, build_id, account_id, 'default' FROM share_links;

DROP TABLE share_links;

ALTER TABLE share_links_new RENAME TO share_links;

CREATE INDEX idx_share_links_build ON share_links(build_id);
CREATE INDEX idx_share_links_account ON share_links(account_id);
CREATE INDEX idx_share_links_team ON share_links(team_id);
