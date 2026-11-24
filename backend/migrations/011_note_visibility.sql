ALTER TABLE agent_builds ADD COLUMN is_note_public INTEGER NOT NULL DEFAULT 0 CHECK (is_note_public IN (0, 1));
ALTER TABLE teams ADD COLUMN is_note_public INTEGER NOT NULL DEFAULT 0 CHECK (is_note_public IN (0, 1));

UPDATE agent_builds SET is_note_public = 1 WHERE trim(description, char(9, 10, 11, 12, 13, 32)) <> '';
UPDATE teams SET is_note_public = 1 WHERE trim(description, char(9, 10, 11, 12, 13, 32)) <> '';
