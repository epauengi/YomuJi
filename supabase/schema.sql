-- ============================================================================
-- YomuJi Japanese-Vietnamese Dictionary Supabase PostgreSQL Database Schema
-- Supports 245,661 Terms, 10,355 Kanji, Full-Text Search (FTS), and Indexing
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ----------------------------------------------------------------------------
-- 1. TERMS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.terms (
  id TEXT PRIMARY KEY,
  sequence INT NOT NULL DEFAULT 0,
  surface TEXT NOT NULL,
  reading TEXT NOT NULL,
  romaji TEXT NOT NULL,
  meanings_vi TEXT[] NOT NULL DEFAULT '{}',
  glosses_raw TEXT[] NOT NULL DEFAULT '{}',
  part_of_speech TEXT[] NOT NULL DEFAULT '{}',
  tags TEXT[] NOT NULL DEFAULT '{}',
  score INT NOT NULL DEFAULT 0,
  is_common BOOLEAN NOT NULL DEFAULT FALSE,
  kanji TEXT[] NOT NULL DEFAULT '{}',
  kanji_readings JSONB NOT NULL DEFAULT '[]'::jsonb,
  search_aliases TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Terms Indexes for instant 1ms lookups & trigram fuzzy search
CREATE INDEX IF NOT EXISTS idx_terms_surface ON public.terms USING btree (surface);
CREATE INDEX IF NOT EXISTS idx_terms_reading ON public.terms USING btree (reading);
CREATE INDEX IF NOT EXISTS idx_terms_romaji ON public.terms USING btree (romaji);
CREATE INDEX IF NOT EXISTS idx_terms_is_common ON public.terms USING btree (is_common);
CREATE INDEX IF NOT EXISTS idx_terms_score ON public.terms USING btree (score DESC);
CREATE INDEX IF NOT EXISTS idx_terms_surface_trgm ON public.terms USING gin (surface gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_terms_reading_trgm ON public.terms USING gin (reading gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_terms_meanings_vi ON public.terms USING gin (meanings_vi);

-- ----------------------------------------------------------------------------
-- 2. KANJIS TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kanjis (
  literal TEXT PRIMARY KEY,
  on_readings TEXT[] NOT NULL DEFAULT '{}',
  kun_readings TEXT[] NOT NULL DEFAULT '{}',
  han_viet TEXT[] NOT NULL DEFAULT '{}',
  meanings TEXT[] NOT NULL DEFAULT '{}',
  meanings_raw TEXT[] NOT NULL DEFAULT '{}',
  radical TEXT,
  pen_strokes TEXT,
  stroke_count INT,
  jlpt TEXT,
  grade INT,
  frequency INT,
  unicode TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  components TEXT[] NOT NULL DEFAULT '{}',
  stroke_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Kanji Indexes
CREATE INDEX IF NOT EXISTS idx_kanjis_literal ON public.kanjis USING btree (literal);
CREATE INDEX IF NOT EXISTS idx_kanjis_jlpt ON public.kanjis USING btree (jlpt);
CREATE INDEX IF NOT EXISTS idx_kanjis_han_viet ON public.kanjis USING gin (han_viet);
CREATE INDEX IF NOT EXISTS idx_kanjis_on_readings ON public.kanjis USING gin (on_readings);
CREATE INDEX IF NOT EXISTS idx_kanjis_kun_readings ON public.kanjis USING gin (kun_readings);

-- ----------------------------------------------------------------------------
-- 3. EXAMPLES TABLE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.examples (
  id TEXT PRIMARY KEY,
  term_id TEXT REFERENCES public.terms(id) ON DELETE CASCADE,
  term_sequence INT NOT NULL DEFAULT 0,
  text_ja TEXT NOT NULL,
  text_vi TEXT NOT NULL,
  highlight TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_examples_term_id ON public.examples USING btree (term_id);

-- ----------------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kanjis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.examples ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all dictionary tables
CREATE POLICY "Allow public read terms" ON public.terms FOR SELECT USING (true);
CREATE POLICY "Allow public read kanjis" ON public.kanjis FOR SELECT USING (true);
CREATE POLICY "Allow public read examples" ON public.examples FOR SELECT USING (true);

-- Allow service role key write access for seeding
CREATE POLICY "Allow service role write terms" ON public.terms FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role write kanjis" ON public.kanjis FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role write examples" ON public.examples FOR ALL USING (auth.role() = 'service_role');
