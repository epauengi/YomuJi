# Development

[English README](../README.md) · [日本語 README](../README.ja.md)

## Local Setup

Requires Node.js 20.9 or later and npm. The repository includes `package-lock.json`.

```bash
git clone https://github.com/epauengi/YomuJi.git
cd YomuJi
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The checked-in dictionary data can be downloaded through **Thiết lập → Tải dữ liệu offline** without database credentials. Initial downloads require a connection; word details are fetched as needed, so this is not a fully offline installation.

## Optional Services

For online dictionary search or AI explanations, create an ignored `.env.local` containing only the values needed for your chosen services. See [`.env.example`](../.env.example) for variable names and placeholders; do not use its placeholder credentials as working values.

- **Supabase dictionary:** `DICTIONARY_BACKEND=supabase` (default), `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The database needs the dictionary schema and data; see [`supabase/`](../supabase/).
- **Turso dictionary:** `DICTIONARY_BACKEND=turso`, `TURSO_DATABASE_URL`, and `TURSO_AUTH_TOKEN`. Schema and validation tooling are in [`turso/`](../turso/); operational notes are in the existing [migration handbook](./turso-migration.md).
- **Backend comparison:** `DICTIONARY_BACKEND=compare` needs both backends and is intended for development checks.
- **AI kanji explanations:** `NVIDIA_API_KEY` for NVIDIA NIM (`nvidia/nemotron-3-nano-omni-30b-a3b-reasoning`), with `GEMINI_API_KEY` as fallback. Either provider can be configured alone. Keys are server-only. NVIDIA API reference: https://docs.api.nvidia.com/nim/reference/nvidia-nemotron-3-nano-omni-30b-a3b-reasoning-infer.
- **Administrative scripts:** `SUPABASE_SERVICE_ROLE_KEY` is for server-side administrative access, not browser use or basic local startup.

Never commit credentials. Keep service-role keys, database tokens, and AI keys server-side; do not give them a `NEXT_PUBLIC_` prefix. Restart the development server after changing service configuration.

## Checks and Commands

```bash
# Type-check
npx tsc --noEmit

# Check generated word routes, then build
npm run build

# Serve the production build
npm run start

# Validate a configured Turso database against the static dictionary
npm run turso:validate
```

There is no test script. The current `npm run lint` calls `next lint`, which is unavailable in Next.js 16; no ESLint flat configuration is checked in.

Routine setup does not require rebuilding or migrating dictionary data. `npm run build:dict` depends on raw source files at a hard-coded local path in [`scripts/build-dictionary.ts`](../scripts/build-dictionary.ts). `npm run turso:migrate` writes to the configured database; review the migration handbook and script before running it. **Do not run `npm run supabase:clear` for setup: it deletes dictionary data.**

## Code Map

- [`src/app/`](../src/app/) — Pages and server API handlers.
- [`src/components/`](../src/components/) — Dictionary, reader, and shared UI.
- [`src/lib/dictionary/`](../src/lib/dictionary/) — Supabase, Turso, and comparison repositories.
- [`src/lib/dictionaryService.ts`](../src/lib/dictionaryService.ts) — Browser dictionary access and downloaded data.
- [`src/lib/browserState.ts`](../src/lib/browserState.ts) — Browser-local saved items and preferences.
- [`public/dict/`](../public/dict/) — Checked-in dictionary data and stroke assets.

Verify new product claims against the actual screens. JLPT is a placeholder; `/flashcards` uses sample data. `/review` uses saved vocabulary but does not persist session results. Keep the English and Japanese READMEs synchronized when user-facing behavior changes.
