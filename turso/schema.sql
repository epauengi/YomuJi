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

-- Alternate spellings are indexed separately so term/search rows stay unchanged.
CREATE TABLE IF NOT EXISTS term_written_forms (
  term_id TEXT NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  written_form TEXT NOT NULL,
  search_key TEXT NOT NULL,
  PRIMARY KEY (term_id, written_form)
);

CREATE INDEX IF NOT EXISTS idx_term_written_forms_form ON term_written_forms(search_key);

-- Omoha grouped details; additive so existing term rows and indexes stay intact.
CREATE TABLE IF NOT EXISTS term_senses (
  term_id TEXT PRIMARY KEY NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  sequence INTEGER NOT NULL UNIQUE,
  data_version TEXT NOT NULL,
  written_forms TEXT NOT NULL DEFAULT '[]',
  reading_forms TEXT NOT NULL DEFAULT '[]',
  senses TEXT NOT NULL DEFAULT '[]'
);

-- Pitch accent downstep positions (Kanjium); additive so existing term rows stay intact.
CREATE TABLE IF NOT EXISTS term_pitch_accents (
  term_id TEXT PRIMARY KEY NOT NULL REFERENCES terms(id) ON DELETE CASCADE,
  pitches TEXT NOT NULL DEFAULT '[]'
);

-- JLPT Grammar Points (N5-N1); additive so existing dictionary tables stay intact.
CREATE TABLE IF NOT EXISTS grammar_points (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  pattern TEXT NOT NULL,
  reading TEXT NOT NULL DEFAULT '',
  romaji TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL,
  meaning_vi TEXT NOT NULL,
  meaning_en TEXT NOT NULL DEFAULT '',
  formation TEXT NOT NULL DEFAULT '',
  nuance_vi TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  examples TEXT NOT NULL DEFAULT '[]',
  match_patterns TEXT NOT NULL DEFAULT '[]',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_grammar_points_level ON grammar_points(level, sort_order);

-- Full-Text Search (FTS5) for Grammar Points
CREATE VIRTUAL TABLE IF NOT EXISTS grammar_points_fts USING fts5(
  id UNINDEXED,
  pattern,
  reading,
  romaji,
  meaning_vi,
  meaning_en,
  formation,
  nuance_vi,
  tags,
  tokenize='unicode61 remove_diacritics 2'
);

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

-- JMnedict Proper Names; additive so existing dictionary tables stay intact.
CREATE TABLE IF NOT EXISTS names (
  surface TEXT NOT NULL,
  reading TEXT NOT NULL,
  norm_surface TEXT NOT NULL,
  norm_reading TEXT NOT NULL,
  mask INTEGER NOT NULL,
  data_version TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (surface, reading)
);

CREATE INDEX IF NOT EXISTS idx_names_norm_surface ON names(norm_surface);
CREATE INDEX IF NOT EXISTS idx_names_norm_reading ON names(norm_reading);
CREATE INDEX IF NOT EXISTS idx_names_data_version ON names(data_version);

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
