# YomuJi Dictionary Data Migration Handbook: Supabase → Turso (libSQL)

This document provides a comprehensive operational guide for migrating YomuJi's dictionary dataset (`terms` and `kanjis`) from Supabase Free PostgreSQL (500 MB limit) to Turso (libSQL/SQLite cloud database).

---

## 1. Architecture Overview

### Before Migration
```text
Client / Frontend (Next.js)
  └── Supabase PostgreSQL Database (Single Monolith)
        ├── Authentication & Profiles
        ├── Bookmark & Search History
        ├── Dictionary Terms (~277,657 rows / 362 MB)
        └── Dictionary Kanjis (~10,355 rows / 24 MB)
```

### After Migration (Decoupled Architecture)
```text
Client / Frontend (Next.js)
  ├── Supabase PostgreSQL (User-Centric & Dynamic Data)
  │     ├── Auth & User Profiles
  │     ├── Bookmarks & Saved Terms (Referencing term_id)
  │     ├── Search History & Custom Lists
  │     └── Settings
  │
  └── Turso libSQL Cloud Database (Read-Heavy Dictionary Engine)
        ├── terms (~277,657 rows)
        ├── kanjis (~10,355 rows)
        ├── terms_fts (Full-text search virtual table)
        └── kanjis_fts (Full-text search virtual table)
```

---

## 2. Environment Variables

Add the following to `.env.local` (server-side only, do not prefix with `NEXT_PUBLIC_`):

```env
# Feature Flag: 'supabase' (default) | 'turso' | 'compare'
DICTIONARY_BACKEND=supabase

# Turso Cloud Credentials
TURSO_DATABASE_URL=libsql://yomuji-dict-your-org.turso.io
TURSO_AUTH_TOKEN=ey...
```

---

## 3. How to Create a Turso Database

1. Install the Turso CLI:
   ```bash
   # Windows (PowerShell)
   irm https://get.turso.tech/install.ps1 | iex
   ```
2. Authenticate:
   ```bash
   turso auth login
   ```
3. Create a new database:
   ```bash
   turso db create yomuji-dict
   ```
4. Get Database URL:
   ```bash
   turso db show yomuji-dict --url
   ```
5. Create Auth Token:
   ```bash
   turso db tokens create yomuji-dict
   ```

---

## 4. How to Run Migration Scripts

### Step 4.1: Dry-Run Migration (Testing & Validation)
Executes data fetching from Supabase, transformation, and JSON serialization without writing to Turso:

```bash
npm run turso:migrate -- --dry-run --limit=100
```

### Step 4.2: Sample Import (First 10,000 Records)
Imports a initial chunk of 10,000 terms to verify schema and latency:

```bash
npm run turso:migrate -- --limit=10000
```

### Step 4.3: Full Migration
Imports all 277,657 terms and 10,355 kanji records using resumable keyset pagination:

```bash
npm run turso:migrate
```

### Step 4.4: Resuming an Interrupted Migration
If a network disconnect occurs mid-migration, resume from `.turso-checkpoint.json`:

```bash
npm run turso:migrate -- --resume
```

---

## 5. How to Run Validation

After completing migration, execute the post-migration validation suite:

```bash
npm run turso:validate
```

This verifies:
- Exact row count parity between Supabase and Turso.
- Field-by-field equality for 20 random samples.
- Preservation of Japanese Kanji, Kana, and Vietnamese diacritics.
- Standard search test queries (`日本`, `日`, `学校`, `にほん`, `ニホン`, `nihon`, `gakkou`, `Nhật Bản`, `trường học`).

---

## 6. How to Switch Backend to Turso

Once data is fully migrated and validated:

1. Update `.env.local` or environment settings in production:
   ```env
   DICTIONARY_BACKEND=turso
   ```
2. Restart the Next.js server / redeploy on Vercel/Netlify.
3. Verify that `/api/search` and word detail pages operate seamlessly.

---

## 7. How to Rollback (Zero Downtime)

If any issue arises in production:

1. Change environment variable back to:
   ```env
   DICTIONARY_BACKEND=supabase
   ```
2. No database restore or rollback script is required. Supabase PostgreSQL remains completely intact and up-to-date.

---

## 8. Remaining Items & Future Recommendations

- **Examples Table**: In future phases, sentence examples (`examples` & `term_examples`) can be added directly to Turso.
- **Search Shards Backup**: Maintain offline static shards under `public/dict/` as a zero-network client-side fallback.

---

## 9. When is it Safe to Drop Dictionary Tables from Supabase?

Only drop `public.terms` and `public.kanjis` from Supabase when:
1. Turso backend has been running stably in production for at least 14 days with zero downtime.
2. All bookmark & user list references have been confirmed to rely solely on `term_id` / `kanji_id`.
3. Database storage usage on Supabase is freed up after taking a full SQL dump backup.
