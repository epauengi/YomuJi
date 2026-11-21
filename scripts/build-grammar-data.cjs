#!/usr/bin/env node
/**
 * Build public/dict/meta/grammar-points.json from OpenJLPT N5-N1 grammar datasets
 * with Vietnamese localization via Gemini Flash (resumable cache).
 *
 * Usage:
 *   node --env-file=.env.local scripts/build-grammar-data.cjs
 *   node scripts/build-grammar-data.cjs --skip-translate   # build using existing cache / EN fallback
 */

const fs = require('node:fs');
const path = require('node:path');
const { applyGrammarViOverrides } = require('./grammar-vi-overrides.cjs');

const LEVELS = ['n5', 'n4', 'n3', 'n2', 'n1'];
const BASE_URL = 'https://raw.githubusercontent.com/evanclan/OpenJLPT/main/data/json/grammar';
const TEMP_DIR = 'C:/Users/Slim5/AppData/Local/Temp/antigravity/openjlpt-grammar';
const CACHE_PATH = 'C:/Users/Slim5/AppData/Local/Temp/antigravity/grammar-vi-cache.json';
const OUT_PATH = path.resolve(process.cwd(), 'public/dict/meta/grammar-points.json');

const GEMINI_MODELS = ['gemini-3-flash-preview', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'];
const BATCH_SIZE = 18;
const CONCURRENCY = 4;
const SKIP_TRANSLATE = process.argv.includes('--skip-translate');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function downloadLevel(level) {
  ensureDir(TEMP_DIR);
  const localPath = path.join(TEMP_DIR, `${level}.json`);
  if (fs.existsSync(localPath)) {
    return JSON.parse(fs.readFileSync(localPath, 'utf8'));
  }
  const url = `${BASE_URL}/${level}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  const text = await res.text();
  fs.writeFileSync(localPath, text, 'utf8');
  return JSON.parse(text);
}

function normalizeFormation(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/\bVerb-nai stem\b/g, 'Vない (bỏ ない)')
    .replace(/\bVerb-stem\b/g, 'Vます (bỏ ます)')
    .replace(/\bVerb-dict\b/g, 'Vる (thể từ điển)')
    .replace(/\bVerb-plain\b/g, 'V thể thường')
    .replace(/\bVerb-te\b/g, 'Vて')
    .replace(/\bVerb-ta\b/g, 'Vた')
    .replace(/\bVerb-nai\b/g, 'Vない')
    .replace(/\bVerb-volitional\b/g, 'V意向 (thể ý định)')
    .replace(/\bVerb-ba\b/g, 'Vば')
    .replace(/\bVerb-potential\b/g, 'V khả năng')
    .replace(/\bVerb-passive\b/g, 'V bị động')
    .replace(/\bVerb-causative\b/g, 'V sai khiến')
    .replace(/\bVerb-imperative\b/g, 'V mệnh lệnh')
    .replace(/\bi-Adj-ku\b/g, 'Aい (bỏ い) + く')
    .replace(/\bi-Adj\b/g, 'Aい')
    .replace(/\bna-Adj\b/g, 'Aな')
    .replace(/\bNoun\b/g, 'N')
    .replace(/\bSentence\b/g, 'Câu')
    .replace(/\bPlain form\b/gi, 'Thể thường')
    .replace(/\bQuestion word\b/gi, 'Từ để hỏi');
}

/**
 * Expand optional Japanese parentheses like `〜上（に）` -> [`〜上に`, `〜上`]
 * and strip English annotations like `〜に（time）`.
 */
function expandVariant(raw) {
  const cleaned = raw
    .replace(/（[^）\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]+）/gu, '')
    .replace(/\([^)\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]+\)/gu, '')
    .trim();

  const out = new Set();
  const optMatch = cleaned.match(/[（(]([^）)]+)[）)]/);
  if (optMatch) {
    const withOpt = cleaned.replace(/[（(]([^）)]+)[）)]/g, '$1');
    const withoutOpt = cleaned.replace(/[（(][^）)]+[）)]/g, '');
    out.add(withOpt);
    out.add(withoutOpt);
  } else {
    out.add(cleaned);
  }
  return [...out];
}

function buildMatchPatterns(item) {
  const rawSources = [item.pattern];
  if (item.reading) rawSources.push(item.reading);

  const patterns = new Set();
  for (const src of rawSources) {
    const stripped = String(src)
      .replace(/（[^）\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]+）/gu, '')
      .replace(/\([^)\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]+\)/gu, '');
    const branches = stripped.split(/\s*[/／]\s*/);
    for (const branch of branches) {
      for (const expanded of expandVariant(branch)) {
        // Normalize wave dashes
        const normalized = expanded
          .replace(/^[〜~・…\s]+/, '')
          .replace(/[〜~・…\s]+$/, '')
          .replace(/[〜~…]+/g, '〜')
          .trim();
        if (!normalized) continue;
        // Skip empty / pure punctuation
        if (!/[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]/u.test(normalized)) continue;
        patterns.add(normalized);
      }
    }
  }
  return [...patterns];
}

async function callGeminiTranslate(items, apiKey) {
  const payload = items.map((item) => ({
    id: item.id,
    pattern: item.pattern,
    level: item.level,
    meaning: item.meaning,
    notes: item.notes || '',
    examples: (item.examples || []).map((ex) => ({ ja: ex.ja, en: ex.en })),
  }));

  const prompt = [
    'Bạn là biên tập viên ngữ pháp tiếng Nhật cho người Việt (phong cách rõ ràng, súc tích như giáo trình Shin Kanzen Master / Mazii).',
    'Dịch chính xác danh sách điểm ngữ pháp JLPT sau sang tiếng Việt tự nhiên.',
    'Yêu cầu bắt buộc:',
    '- Trả về DUY NHẤT một JSON array hợp lệ theo đúng thứ tự input, mỗi phần tử có dạng:',
    '  {"id":"...","meaningVi":"nghĩa tiếng Việt ngắn gọn rõ ràng","nuanceVi":"giải thích sắc thái, ngữ cảnh dùng, phân biệt mẫu dễ nhầm (giữ nguyên các từ/mẫu tiếng Nhật trong ngoặc hoặc trực tiếp)","examplesVi":["nghĩa câu ví dụ 1","nghĩa câu ví dụ 2",...]}',
    '- Độ dài mảng examplesVi PHẢI khớp chính xác số lượng examples của từng mục.',
    '- Không thêm markdown, không giải thích ngoài JSON.',
    '',
    'Dữ liệu đầu vào:',
    JSON.stringify(payload),
  ].join('\n');

  let lastError = null;
  for (const model of GEMINI_MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json',
              },
            }),
            signal: AbortSignal.timeout(90_000),
          }
        );

        if (res.status === 429 || res.status >= 500) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        if (!res.ok) {
          lastError = new Error(`${model} HTTP ${res.status}`);
          break;
        }
        const json = await res.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          lastError = new Error(`${model} empty response`);
          continue;
        }
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed)) {
          lastError = new Error(`${model} non-array JSON`);
          continue;
        }
        return parsed;
      } catch (err) {
        lastError = err;
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastError || new Error('Gemini translation failed');
}

function loadCache() {
  if (!fs.existsSync(CACHE_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveCache(cache) {
  ensureDir(path.dirname(CACHE_PATH));
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

async function main() {
  const rawAll = [];
  for (const lvl of LEVELS) {
    const items = await downloadLevel(lvl);
    rawAll.push(...items);
  }
  console.log(`Loaded ${rawAll.length} OpenJLPT grammar points across N5-N1.`);

  const cache = loadCache();
  const apiKey = process.env.GEMINI_API_KEY;

  if (!SKIP_TRANSLATE && apiKey) {
    const missing = rawAll.filter((item) => {
      const hit = cache[item.id];
      return !hit || !hit.meaningVi || !Array.isArray(hit.examplesVi) || hit.examplesVi.length !== (item.examples?.length || 0);
    });

    console.log(`Cached Vietnamese translations: ${rawAll.length - missing.length}/${rawAll.length}. Missing: ${missing.length}.`);

    if (missing.length > 0) {
      const batches = [];
      for (let i = 0; i < missing.length; i += BATCH_SIZE) {
        batches.push(missing.slice(i, i + BATCH_SIZE));
      }

      let doneBatches = 0;
      let cursor = 0;

      async function worker() {
        while (cursor < batches.length) {
          const idx = cursor++;
          const batch = batches[idx];
          try {
            const translated = await callGeminiTranslate(batch, apiKey);
            const byId = new Map(translated.map((entry) => [entry.id, entry]));
            let savedInBatch = 0;
            for (const item of batch) {
              const t = byId.get(item.id);
              if (t && typeof t.meaningVi === 'string' && t.meaningVi.trim()) {
                cache[item.id] = {
                  meaningVi: t.meaningVi.trim(),
                  nuanceVi: typeof t.nuanceVi === 'string' ? t.nuanceVi.trim() : '',
                  examplesVi: Array.isArray(t.examplesVi)
                    ? t.examplesVi.map((s) => String(s || '').trim())
                    : [],
                };
                savedInBatch++;
              }
            }
            doneBatches++;
            saveCache(cache);
            console.log(`Batch ${doneBatches}/${batches.length} done (+${savedInBatch} items).`);
          } catch (err) {
            doneBatches++;
            console.error(`Batch ${idx + 1} failed:`, err instanceof Error ? err.message : err);
          }
        }
      }

      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
    }
  } else if (!SKIP_TRANSLATE) {
    console.warn('GEMINI_API_KEY missing; building with cached/English fallback.');
  }

  const output = rawAll.map((item, idx) => {
    const vi = cache[item.id] || {};
    const examples = (item.examples || []).map((ex, exIdx) => ({
      ja: String(ex.ja || '').trim(),
      ...(ex.furigana ? { furigana: String(ex.furigana).trim() } : {}),
      vi: (Array.isArray(vi.examplesVi) && vi.examplesVi[exIdx]) ? vi.examplesVi[exIdx] : String(ex.en || '').trim(),
      en: String(ex.en || '').trim(),
    }));

    return applyGrammarViOverrides({
      id: item.id,
      slug: item.id,
      pattern: String(item.pattern || '').trim(),
      reading: String(item.reading || item.pattern || '').trim(),
      romaji: String(item.romaji || '').trim(),
      level: String(item.level || 'N5').toUpperCase(),
      meaningVi: vi.meaningVi || String(item.meaning || '').trim(),
      meaningEn: String(item.meaning || '').trim(),
      formation: normalizeFormation(item.formation || ''),
      nuanceVi: vi.nuanceVi || String(item.notes || '').trim(),
      tags: Array.isArray(item.tags) ? item.tags.map((t) => String(t).trim()).filter(Boolean) : [],
      examples,
      matchPatterns: buildMatchPatterns(item),
      order: idx + 1,
    });
  });

  ensureDir(path.dirname(OUT_PATH));
  fs.writeFileSync(OUT_PATH, JSON.stringify(output), 'utf8');
  const translatedCount = output.filter((item) => Boolean(cache[item.id]?.meaningVi)).length;
  const sizeKb = (fs.statSync(OUT_PATH).size / 1024).toFixed(1);
  console.log(`Wrote ${output.length} grammar points (${translatedCount} Vietnamese localized) to ${OUT_PATH} (${sizeKb} KB).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
