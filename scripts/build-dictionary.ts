import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  TermRecord,
  KanjiRecord,
  SearchIndexEntry,
  KanjiSearchIndexEntry,
  DictionaryManifest,
  DictionaryShard,
  JLPTLevel,
} from '../src/types/dictionary';

// Input raw data paths
const RAW_DATA_BASE = 'D:\\IT\\Project\\Data JPVNDict\\Data';
const JMDICT_DIR = path.join(RAW_DATA_BASE, 'jmdict_vietnamese');
const KANJIDIC_DIR = path.join(RAW_DATA_BASE, 'kanjidic_vietnamese');
const KANJIDICT_VN_DIR = path.join(RAW_DATA_BASE, 'KanjiDictVN-master', 'KanjiDictVN-master', 'out_vn');
const ANIM_CJK_DIR = path.join(RAW_DATA_BASE, 'animCJK-master', 'animCJK-master');
const KANJIVG_DIR = path.join(RAW_DATA_BASE, 'kanjivg-master', 'kanjivg-master');

// Output target path
const OUTPUT_DIR = path.join(process.cwd(), 'public', 'dict');

// Kana to Romaji converter
const KANA_ROMAJI_MAP: Record<string, string> = {
  あ: 'a', い: 'i', う: 'u', え: 'e', お: 'o',
  か: 'ka', き: 'ki', く: 'ku', け: 'ke', こ: 'ko',
  さ: 'sa', し: 'shi', す: 'su', せ: 'se', そ: 'so',
  た: 'ta', ち: 'chi', つ: 'tsu', て: 'te', と: 'to',
  な: 'na', に: 'ni', ぬ: 'nu', ね: 'ne', の: 'no',
  は: 'ha', ひ: 'hi', ふ: 'fu', へ: 'he', ほ: 'ho',
  ま: 'ma', み: 'mi', む: 'mu', め: 'me', も: 'mo',
  や: 'ya', ゆ: 'yu', よ: 'yo',
  ら: 'ra', り: 'ri', る: 'ru', れ: 're', ろ: 'ro',
  わ: 'wa', を: 'wo', ん: 'n',
  が: 'ga', ぎ: 'gi', ぐ: 'gu', げ: 'ge', ご: 'go',
  ざ: 'za', じ: 'ji', ず: 'zu', ぜ: 'ze', ぞ: 'zo',
  だ: 'da', ぢ: 'ji', づ: 'zu', で: 'de', ど: 'do',
  ば: 'ba', び: 'bi', ぶ: 'bu', べ: 'be', ぼ: 'bo',
  ぱ: 'pa', ぴ: 'pi', ぷ: 'pu', ぺ: 'pe', ぽ: 'po',
  きゃ: 'kya', きゅ: 'kyu', きょ: 'kyo',
  しゃ: 'sha', しゅ: 'shu', しょ: 'sho',
  ちゃ: 'cha', ちゅ: 'chu', ちょ: 'cho',
  にゃ: 'nya', にゅ: 'nyu', にょ: 'nyo',
  ひゃ: 'hya', ひゅ: 'hyu', ひょ: 'hyo',
  みゃ: 'mya', みゅ: 'myu', みょ: 'myo',
  りゃ: 'rya', りゅ: 'ryu', りょ: 'ryo',
  ぎゃ: 'gya', ぎゅ: 'gyu', ぎょ: 'gyo',
  じゃ: 'ja', じゅ: 'ju', じょ: 'jo',
  びゃ: 'bya', びゅ: 'byu', びょ: 'byo',
  ぴゃ: 'pya', ぴゅ: 'pyu', ぴょ: 'pyo',
  ア: 'a', イ: 'i', ウ: 'u', エ: 'e', オ: 'o',
  カ: 'ka', キ: 'ki', ク: 'ku', ケ: 'ke', コ: 'ko',
  サ: 'sa', シ: 'shi', ス: 'su', セ: 'se', ソ: 'so',
  タ: 'ta', チ: 'chi', ツ: 'tsu', テ: 'te', ト: 'to',
  ナ: 'na', ニ: 'ni', ヌ: 'nu', ネ: 'ne', ノ: 'no',
  ハ: 'ha', ヒ: 'hi', フ: 'fu', ヘ: 'he', ホ: 'ho',
  マ: 'ma', ミ: 'mi', ム: 'mu', メ: 'me', モ: 'mo',
  ヤ: 'ya', ユ: 'yu', ヨ: 'yo',
  ラ: 'ra', リ: 'ri', ル: 'ru', レ: 're', ロ: 'ro',
  ワ: 'wa', ヲ: 'wo', ン: 'n',
  ガ: 'ga', ギ: 'gi', グ: 'gu', ゲ: 'ge', ゴ: 'go',
  ザ: 'za', ジ: 'ji', ズ: 'zu', ゼ: 'ze', ゾ: 'zo',
  ダ: 'da', ヂ: 'ji', ヅ: 'zu', デ: 'de', ド: 'do',
  バ: 'ba', ビ: 'bi', ブ: 'bu', ベ: 'be', ボ: 'bo',
  パ: 'pa', ピ: 'pi', プ: 'pu', ペ: 'pe', ポ: 'po',
};

function toRomaji(str: string): string {
  let res = '';
  let i = 0;
  while (i < str.length) {
    if (i + 1 < str.length) {
      const pair = str.slice(i, i + 2);
      if (KANA_ROMAJI_MAP[pair]) {
        res += KANA_ROMAJI_MAP[pair];
        i += 2;
        continue;
      }
    }
    const char = str[i];
    res += KANA_ROMAJI_MAP[char] || char;
    i++;
  }
  return res.toLowerCase();
}

function extractKanji(str: string): string[] {
  const matches = str.match(/[\u4e00-\u9faf\u3400-\u4dbf]/g);
  return matches ? Array.from(new Set(matches)) : [];
}

function computeSha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function parseVietnameseMeanings(defs: any[]): { meaningsVi: string[]; glossesRaw: string[] } {
  const meaningsVi: string[] = [];
  const glossesRaw: string[] = [];

  for (const def of defs) {
    if (typeof def === 'string') {
      glossesRaw.push(def);

      // Clean Yomichan formatting notation like {xxx}
      const cleaned = def.replace(/\{[^}]+\}/g, '').replace(/\\n/g, '\n').trim();
      const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);

      for (const line of lines) {
        let text = line.replace(/^-\s*/, '').trim();
        if (text && !text.startsWith('{')) {
          // If line has vietnamese translation markers or non-english text
          const parts = text.split(/;|\//).map((p) => p.trim()).filter(Boolean);
          for (const p of parts) {
            if (p.length > 0 && !meaningsVi.includes(p)) {
              meaningsVi.push(p);
            }
          }
        }
      }
    }
  }

  return { meaningsVi: meaningsVi.slice(0, 5), glossesRaw };
}

async function main() {
  console.log('🚀 Starting YomuJi Data Pipeline (Phase 2.1)...');
  console.log(`📁 Raw Data Source: ${RAW_DATA_BASE}`);
  console.log(`📁 Output Destination: ${OUTPUT_DIR}`);

  // Create output directories
  const termsDir = path.join(OUTPUT_DIR, 'terms');
  const kanjiDir = path.join(OUTPUT_DIR, 'kanji');
  const searchDir = path.join(OUTPUT_DIR, 'search');
  const strokesDir = path.join(OUTPUT_DIR, 'strokes');
  const metaDir = path.join(OUTPUT_DIR, 'meta');

  [OUTPUT_DIR, termsDir, kanjiDir, searchDir, strokesDir, metaDir].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // ==========================================
  // 1. Process Terms (JMDict Vietnamese)
  // ==========================================
  console.log('\n📖 Processing JMDict Vietnamese Terms...');
  const termFiles = fs.readdirSync(JMDICT_DIR).filter((f) => f.startsWith('term_bank_') && f.endsWith('.json'));
  const termRecordsMap = new Map<string, TermRecord>();

  let rawTermCount = 0;
  for (const file of termFiles) {
    const filePath = path.join(JMDICT_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const entries = JSON.parse(content);
    rawTermCount += entries.length;

    for (const entry of entries) {
      // Entry format: [surface, reading, tags, inflection, score, definitions, sequence, tag_string]
      const [surface, reading, tagStr, , score, defs, sequence] = entry;
      const termId = `${surface}-${reading || surface}-${sequence}`;

      if (termRecordsMap.has(termId)) continue;

      const tags = typeof tagStr === 'string' ? tagStr.split(' ').filter(Boolean) : [];
      const isCommon = tags.some((t) => ['P', 'ichi', 'news', 'spec', 'gai'].includes(t)) || (score && score > 50);

      const kanaReading = reading || surface;
      const romaji = toRomaji(kanaReading);
      const kanjiChars = extractKanji(surface);
      const { meaningsVi, glossesRaw } = parseVietnameseMeanings(defs || []);

      const termRecord: TermRecord = {
        id: termId,
        sequence: sequence || 0,
        surface,
        reading: kanaReading,
        romaji,
        meaningsVi: meaningsVi.length > 0 ? meaningsVi : [defs?.[0] || 'Chưa có nghĩa'],
        glossesRaw,
        partOfSpeech: tags,
        tags,
        score: score || 0,
        isCommon: Boolean(isCommon),
        kanji: kanjiChars,
        examples: [],
        related: [],
        searchAliases: Array.from(new Set([surface, kanaReading, romaji])),
        source: { jmdict: true },
      };

      termRecordsMap.set(termId, termRecord);
    }
  }

  const allTerms = Array.from(termRecordsMap.values()).sort((a, b) => (b.score || 0) - (a.score || 0));
  console.log(`✅ Loaded ${rawTermCount} raw term entries -> ${allTerms.length} unique TermRecords.`);

  // ==========================================
  // 2. Process Kanji (KANJIDIC & KanjiDictVN)
  // ==========================================
  console.log('\n漢 Processing KANJIDIC & KanjiDictVN...');
  const kanjiRecordsMap = new Map<string, KanjiRecord>();

  // Parse KANJIDIC
  const kanjidicFiles = fs.readdirSync(KANJIDIC_DIR).filter((f) => f.startsWith('kanji_bank_') && f.endsWith('.json'));
  for (const file of kanjidicFiles) {
    const content = fs.readFileSync(path.join(KANJIDIC_DIR, file), 'utf-8');
    const entries = JSON.parse(content);

    for (const entry of entries) {
      // Entry: [literal, readings, kun_readings, tag, meanings, meta]
      const [literal, readingsStr, kunStr, tagStr, meanings, meta] = entry;

      const onReadings: string[] = [];
      const hanVietRaw: string[] = [];
      if (readingsStr && typeof readingsStr === 'string') {
        const parts = readingsStr.split(' ').filter(Boolean);
        for (const p of parts) {
          if (/[\u30a0-\u30ff]/.test(p)) onReadings.push(p);
          else if (/^[A-ZÀ-Ỹa-zà-ỹ\s]+$/.test(p)) hanVietRaw.push(p);
        }
      }

      const kunReadings = kunStr && typeof kunStr === 'string' ? kunStr.split(' ').filter(Boolean) : [];
      const tags = tagStr && typeof tagStr === 'string' ? tagStr.split(' ').filter(Boolean) : [];

      let jlptLevel: JLPTLevel | undefined;
      if (meta?.jlpt) {
        jlptLevel = `N${meta.jlpt}` as JLPTLevel;
      }

      const record: KanjiRecord = {
        literal,
        onReadings,
        kunReadings,
        hanViet: hanVietRaw,
        meanings: Array.isArray(meanings) ? meanings.slice(0, 4) : [],
        meaningsRaw: Array.isArray(meanings) ? meanings : [],
        strokeCount: meta?.strokes || 0,
        jlpt: jlptLevel,
        grade: meta?.grade,
        frequency: meta?.freq,
        unicode: `U+${literal.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`,
        tags,
        components: [],
        strokePaths: [],
      };

      kanjiRecordsMap.set(literal, record);
    }
  }

  // Enrich with KanjiDictVN out_vn
  if (fs.existsSync(KANJIDICT_VN_DIR)) {
    const vnFiles = fs.readdirSync(KANJIDICT_VN_DIR).filter((f) => f.startsWith('kanji_bank_') && f.endsWith('.json'));
    for (const file of vnFiles) {
      const content = fs.readFileSync(path.join(KANJIDICT_VN_DIR, file), 'utf-8');
      const entries = JSON.parse(content);

      for (const entry of entries) {
        const [literal, hanvietStr, , , meanings, meta] = entry;
        let record = kanjiRecordsMap.get(literal);

        const cleanHanViet = hanvietStr ? hanvietStr.split(/[,;\s]+/).map((s: string) => s.toUpperCase().trim()).filter(Boolean) : [];

        if (!record) {
          record = {
            literal,
            onReadings: [],
            kunReadings: [],
            hanViet: cleanHanViet,
            meanings: Array.isArray(meanings) ? meanings : [],
            tags: [],
            components: [],
            strokePaths: [],
          };
          kanjiRecordsMap.set(literal, record);
        } else {
          if (cleanHanViet.length > 0) record.hanViet = Array.from(new Set([...cleanHanViet, ...record.hanViet]));
          if (meta?.Radical) record.radical = meta.Radical;
          if (meta?.PenStrokes) record.penStrokes = meta.PenStrokes;
        }
      }
    }
  }

  const allKanji = Array.from(kanjiRecordsMap.values());
  console.log(`✅ Loaded & merged ${allKanji.length} unique KanjiRecords.`);

  // ==========================================
  // 3. Process Stroke SVGs (animCJK & KanjiVG)
  // ==========================================
  console.log('\n✍️ Processing Stroke Animation SVGs...');
  let copiedStrokes = 0;
  const animSvgDir = path.join(ANIM_CJK_DIR, 'svgsJa');

  for (const kanji of allKanji) {
    const charCode = kanji.literal.charCodeAt(0);
    const hexCode = charCode.toString(16).padStart(5, '0').toLowerCase();
    const animSvgPath = path.join(animSvgDir, `${charCode}.svg`);
    const kanjivgSvgPath = path.join(KANJIVG_DIR, 'kanji', `${hexCode}.svg`);
    const destPath = path.join(strokesDir, `${hexCode}.svg`);

    if (fs.existsSync(animSvgPath)) {
      fs.copyFileSync(animSvgPath, destPath);
      copiedStrokes++;
    } else if (fs.existsSync(kanjivgSvgPath)) {
      fs.copyFileSync(kanjivgSvgPath, destPath);
      copiedStrokes++;
    }
  }
  console.log(`✅ Processed & saved ${copiedStrokes} Stroke SVG files into public/dict/strokes/.`);

  // ==========================================
  // 4. Sharding Terms & Kanji JSON Output
  // ==========================================
  console.log('\n📦 Sharding dictionary data...');

  const manifestShards: DictionaryShard[] = [];
  const TERMS_PER_SHARD = 2000;
  const KANJI_PER_SHARD = 500;
  const INDEX_PER_SHARD = 5000;

  // Shard Terms
  const termShardCount = Math.ceil(allTerms.length / TERMS_PER_SHARD);
  for (let i = 0; i < termShardCount; i++) {
    const shardId = `terms-${String(i + 1).padStart(4, '0')}`;
    const chunk = allTerms.slice(i * TERMS_PER_SHARD, (i + 1) * TERMS_PER_SHARD);
    const payload = JSON.stringify({ schemaVersion: 1, dataVersion: '1.0.0', type: 'terms', records: chunk });

    const fileName = `shard-${String(i + 1).padStart(4, '0')}.json`;
    const fileRelPath = `terms/${fileName}`;
    fs.writeFileSync(path.join(termsDir, fileName), payload);

    manifestShards.push({
      id: shardId,
      type: 'terms',
      url: `/dict/${fileRelPath}`,
      bytes: Buffer.byteLength(payload),
      sha256: computeSha256(payload),
      recordCount: chunk.length,
    });
  }

  // Shard Kanji
  const kanjiShardCount = Math.ceil(allKanji.length / KANJI_PER_SHARD);
  for (let i = 0; i < kanjiShardCount; i++) {
    const shardId = `kanji-${String(i + 1).padStart(4, '0')}`;
    const chunk = allKanji.slice(i * KANJI_PER_SHARD, (i + 1) * KANJI_PER_SHARD);
    const payload = JSON.stringify({ schemaVersion: 1, dataVersion: '1.0.0', type: 'kanji', records: chunk });

    const fileName = `shard-${String(i + 1).padStart(4, '0')}.json`;
    const fileRelPath = `kanji/${fileName}`;
    fs.writeFileSync(path.join(kanjiDir, fileName), payload);

    manifestShards.push({
      id: shardId,
      type: 'kanji',
      url: `/dict/${fileRelPath}`,
      bytes: Buffer.byteLength(payload),
      sha256: computeSha256(payload),
      recordCount: chunk.length,
    });
  }

  // Build & Shard Search Index
  console.log('\n🔍 Generating Search Index Shards...');
  const searchIndexEntries: SearchIndexEntry[] = allTerms.map((t) => ({
    termId: t.id,
    sequence: t.sequence,
    surface: t.surface,
    reading: t.reading,
    romaji: t.romaji,
    meaningsPreview: t.meaningsVi.slice(0, 2),
    partOfSpeech: t.partOfSpeech,
    tags: t.tags,
    score: t.score,
    isCommon: t.isCommon,
    kanji: t.kanji,
    tokens: Array.from(new Set([t.surface, t.reading, t.romaji, ...t.meaningsVi])),
  }));

  const searchShardCount = Math.ceil(searchIndexEntries.length / INDEX_PER_SHARD);
  for (let i = 0; i < searchShardCount; i++) {
    const shardId = `search-${String(i + 1).padStart(4, '0')}`;
    const chunk = searchIndexEntries.slice(i * INDEX_PER_SHARD, (i + 1) * INDEX_PER_SHARD);
    const payload = JSON.stringify({ schemaVersion: 1, dataVersion: '1.0.0', type: 'search', records: chunk });

    const fileName = `index-${String(i + 1).padStart(4, '0')}.json`;
    const fileRelPath = `search/${fileName}`;
    fs.writeFileSync(path.join(searchDir, fileName), payload);

    manifestShards.push({
      id: shardId,
      type: 'search',
      url: `/dict/${fileRelPath}`,
      bytes: Buffer.byteLength(payload),
      sha256: computeSha256(payload),
      recordCount: chunk.length,
    });
  }

  // Write Manifest
  const manifest: DictionaryManifest = {
    schemaVersion: 1,
    dataVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    basePath: '/dict',
    totals: {
      terms: allTerms.length,
      kanji: allKanji.length,
      examples: 0,
      termShards: termShardCount,
      searchShards: searchShardCount,
      kanjiShards: kanjiShardCount,
    },
    shards: manifestShards,
    attribution: [
      { name: 'JMdict (Vietnamese)', sourcePath: 'jmdict_vietnamese/' },
      { name: 'KANJIDIC (Vietnamese)', sourcePath: 'kanjidic_vietnamese/' },
      { name: 'KanjiDictVN', sourcePath: 'KanjiDictVN-master/' },
      { name: 'animCJK', sourcePath: 'animCJK-master/' },
      { name: 'KanjiVG', sourcePath: 'kanjivg-master/' },
    ],
  };

  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  // Write Meta Tags
  fs.writeFileSync(
    path.join(metaDir, 'tags.json'),
    JSON.stringify(
      {
        version: '1.0.0',
        tags: {
          P: 'Từ phổ biến',
          ichi: 'Tập từ phổ biến Ichimango',
          news: 'Từ phổ biến trên báo chí',
          spec: 'Từ chuyên ngành',
          'adj-na': 'Tính từ đuôi na',
          'adj-i': 'Tính từ đuôi i',
          n: 'Danh từ',
          v1: 'Động từ nhóm 1 (Ichidan)',
          v5: 'Động từ nhóm 5 (Godan)',
        },
      },
      null,
      2
    )
  );

  console.log('\n🎉 Phase 2.1 Data Pipeline completed successfully!');
  console.log(`📊 Total Terms: ${allTerms.length} across ${termShardCount} shards.`);
  console.log(`📊 Total Kanji: ${allKanji.length} across ${kanjiShardCount} shards.`);
  console.log(`📊 Total Search Index Entries: ${searchIndexEntries.length} across ${searchShardCount} shards.`);
  console.log(`📄 Manifest written to: ${path.join(OUTPUT_DIR, 'manifest.json')}`);
}

main().catch((err) => {
  console.error('❌ Data pipeline failed:', err);
  process.exit(1);
});
