CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  tag TEXT NOT NULL,
  subtag TEXT NOT NULL,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(title, tag, subtag, project_id, type)
);

CREATE INDEX IF NOT EXISTS memories_project_type_idx ON memories(project_id, type);
CREATE INDEX IF NOT EXISTS memories_tag_subtag_idx ON memories(tag, subtag);
CREATE INDEX IF NOT EXISTS memories_updated_at_idx ON memories(updated_at DESC);
