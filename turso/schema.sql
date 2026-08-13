-- ====================================================================
-- YomuJi Dictionary Turso (libSQL / SQLite) Schema Specification
-- Description: Optimized relational & FTS schema for dictionary lookup
-- ====================================================================

-- 1. Terms Table
CREATE TABLE IF NOT EXISTS terms (
  id TEXT PRIMARY KEY,
  sequence INTEGER NOT NULL DEFAULT 0,
  surface TEXT NOT NULL,
  reading TEXT NOT NULL,
  romaji TEXT NOT NULL,
  meanings_vi TEXT NOT NULL DEFAULT '[]',
  glosses_raw TEXT NOT NULL DEFAULT '[]',
  part_of_speech TEXT NOT NULL DEFAULT '[]',
  tags TEXT NOT NULL DEFAULT '[]',
  score INTEGER NOT NULL DEFAULT 0,
  is_common INTEGER NOT NULL DEFAULT 0,
  kanji TEXT NOT NULL DEFAULT '[]',
  kanji_readings TEXT DEFAULT '[]',
  search_aliases TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_terms_surface ON terms(surface);
CREATE INDEX IF NOT EXISTS idx_terms_reading ON terms(reading);
CREATE INDEX IF NOT EXISTS idx_terms_romaji ON terms(romaji);
CREATE INDEX IF NOT EXISTS idx_terms_score ON terms(score DESC);
CREATE INDEX IF NOT EXISTS idx_terms_is_common ON terms(is_common);

-- Full-Text Search (FTS5) for Terms
CREATE VIRTUAL TABLE IF NOT EXISTS terms_fts USING fts5(
  id UNINDEXED,
  surface,
  reading,
  romaji,
  meanings_vi,
  search_aliases,
  tokenize='unicode61 remove_diacritics 2'
);

-- 2. Kanjis Table
CREATE TABLE IF NOT EXISTS kanjis (
  literal TEXT PRIMARY KEY,
  on_readings TEXT NOT NULL DEFAULT '[]',
  kun_readings TEXT NOT NULL DEFAULT '[]',
  han_viet TEXT NOT NULL DEFAULT '[]',
  meanings TEXT NOT NULL DEFAULT '[]',
  meanings_raw TEXT DEFAULT '[]',
  radical TEXT,
  pen_strokes TEXT,
  stroke_count INTEGER,
  jlpt TEXT,
  grade INTEGER,
  frequency INTEGER,
  unicode TEXT,
  tags TEXT DEFAULT '[]',
  components TEXT DEFAULT '[]',
  stroke_paths TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now'))
);

-- Full-Text Search (FTS5) for Kanji
CREATE VIRTUAL TABLE IF NOT EXISTS kanjis_fts USING fts5(
  literal UNINDEXED,
  literal_text,
  han_viet,
  on_readings,
  kun_readings,
  meanings,
  tokenize='unicode61 remove_diacritics 2'
);

-- 3. Auxiliary & Operational Tables
CREATE TABLE IF NOT EXISTS dictionary_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS migration_checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_name TEXT NOT NULL,
  last_id TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress',
  timestamp TEXT DEFAULT (datetime('now'))
);
