// Run: node scripts/check-book-catalogue.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const zlib = require('node:zlib');
const ts = require('typescript');

function loadModule(file, fetchImpl, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const fallbackFetch = async () => new Response('Unavailable', { status: 503 });
  vm.runInNewContext(code, {
    exports,
    module: { exports },
    fetch: fetchImpl || fallbackFetch,
    Response,
    Request,
    Headers,
    TextDecoder,
    AbortSignal,
    AbortController,
    Buffer,
    Uint8Array,
    setTimeout,
    clearTimeout,
    console,
    Date,
    URL,
    URLSearchParams,
    require: (name) => {
      if (name === 'server-only') return {};
      if (name === 'next/server') return imports[name] || { after: () => {} };
      if (name === 'node:zlib') return zlib;
      if (name === 'node:assert/strict') return assert;
      if (name in imports) return imports[name];
      if (name === '@/data/books') {
        return loadModule('src/data/books.ts', fetchImpl, imports);
      }
      if (name === '@/data/book-catalogue.json') {
        const jsonPath = path.join(__dirname, '..', 'src', 'data', 'book-catalogue.json');
        if (fs.existsSync(jsonPath)) {
          const entries = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          entries.default = entries;
          return entries;
        }
        const empty = [];
        empty.default = empty;
        return empty;
      }
      if (name === '@/lib/bookCatalogue') {
        return loadModule('src/lib/bookCatalogue.ts', fetchImpl, imports);
      }
      if (name === '@/lib/bookCovers') {
        return loadModule('src/lib/bookCovers.ts', fetchImpl, imports);
      }
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename: file });
  return exports;
}

// Minimal CRC32 implementation for spec-compliant ZIP generation
function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createZipFixture(filename, content, options = {}) {
  const fileBytes = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
  const method = options.method !== undefined ? options.method : 8; // 8 = Deflate, 0 = Store
  const compBytes = options.rawCompBytes || (method === 8 ? zlib.deflateRawSync(fileBytes) : fileBytes);
  const fnBytes = Buffer.from(filename, 'utf8');
  const fileCrc = options.crc !== undefined ? options.crc : crc32(fileBytes);
  const compSize = options.compSize !== undefined ? options.compSize : compBytes.length;
  const uncompSize = options.uncompSize !== undefined ? options.uncompSize : fileBytes.length;
  const flags = options.flags !== undefined ? options.flags : 0;
  const totalEntries = options.totalEntries !== undefined ? options.totalEntries : 1;

  // Local file header
  const lh = Buffer.alloc(30 + fnBytes.length);
  lh.writeUInt32LE(options.lhSig || 0x04034b50, 0);
  lh.writeUInt16LE(20, 4);
  lh.writeUInt16LE(flags, 6);
  lh.writeUInt16LE(method, 8);
  lh.writeUInt16LE(0, 10);
  lh.writeUInt16LE(0, 12);
  lh.writeUInt32LE(fileCrc, 14);
  lh.writeUInt32LE(compSize, 18);
  lh.writeUInt32LE(uncompSize, 22);
  lh.writeUInt16LE(fnBytes.length, 26);
  lh.writeUInt16LE(0, 28);
  fnBytes.copy(lh, 30);

  const locOffset = 0;
  const cdOffset = lh.length + compBytes.length;

  // Central directory header
  const cd = Buffer.alloc(46 + fnBytes.length);
  cd.writeUInt32LE(options.cdSig || 0x02014b50, 0);
  cd.writeUInt16LE(20, 4);
  cd.writeUInt16LE(20, 6);
  cd.writeUInt16LE(flags, 8);
  cd.writeUInt16LE(method, 10);
  cd.writeUInt16LE(0, 12);
  cd.writeUInt16LE(0, 14);
  cd.writeUInt32LE(fileCrc, 16);
  cd.writeUInt32LE(compSize, 20);
  cd.writeUInt32LE(uncompSize, 24);
  cd.writeUInt16LE(fnBytes.length, 28);
  cd.writeUInt16LE(0, 30);
  cd.writeUInt16LE(0, 32);
  cd.writeUInt16LE(0, 34);
  cd.writeUInt16LE(0, 36);
  cd.writeUInt32LE(0, 38);
  cd.writeUInt32LE(locOffset, 42);
  fnBytes.copy(cd, 46);

  // End of Central Directory (EOCD)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(options.eocdSig || 0x06054b50, 0);
  eocd.writeUInt16LE(options.diskNumber || 0, 4);
  eocd.writeUInt16LE(options.cdStartDisk || 0, 6);
  eocd.writeUInt16LE(totalEntries, 8);
  eocd.writeUInt16LE(totalEntries, 10);
  eocd.writeUInt32LE(options.cdSize !== undefined ? options.cdSize : cd.length, 12);
  eocd.writeUInt32LE(options.cdOffset !== undefined ? options.cdOffset : cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  const parts = [lh, compBytes, cd, eocd];
  if (options.appendZip64) {
    const zip64Loc = Buffer.alloc(20);
    zip64Loc.writeUInt32LE(0x07064b50, 0);
    parts.unshift(zip64Loc);
  }
  return Buffer.concat(parts);
}

const REQUIRED_HEADERS = [
  '作品ID',
  '作品名',
  '作品名読み',
  '分類番号',
  '文字遣い種別',
  '作品著作権フラグ',
  '姓',
  '名',
  '姓ローマ字',
  '名ローマ字',
  '役割フラグ',
  '人物著作権フラグ',
  'XHTML/HTMLファイルURL',
  'XHTML/HTMLファイル符号化方式',
];

function buildCsvRow(values) {
  const full = REQUIRED_HEADERS.map((h) => {
    const val = values[h] !== undefined ? String(values[h]) : '';
    if (val.includes(',') || val.includes('"') || val.includes('\n')) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  });
  return full.join(',');
}

function buildCsv(rows) {
  return [REQUIRED_HEADERS.join(','), ...rows.map(buildCsvRow)].join('\r\n');
}

async function main() {
  const catalogueModule = loadModule('src/lib/bookCatalogue.ts');

  // ==========================================
  // 1. extractCatalogueCsv: extraction & safety
  // ==========================================
  {
    const sampleCsv = '作品ID,作品名\n1,テスト';
    const deflatedZip = createZipFixture('list.csv', sampleCsv, { method: 8 });
    const storedZip = createZipFixture('list.csv', sampleCsv, { method: 0 });

    // Method 8 deflate and method 0 store
    assert.equal(catalogueModule.extractCatalogueCsv(deflatedZip), sampleCsv);
    assert.equal(catalogueModule.extractCatalogueCsv(storedZip), sampleCsv);

    // Uint8Array input support
    assert.equal(catalogueModule.extractCatalogueCsv(new Uint8Array(deflatedZip)), sampleCsv);

    // BOM stripping
    const bomCsv = '\uFEFF' + sampleCsv;
    const bomZip = createZipFixture('list.csv', bomCsv, { method: 0 });
    assert.equal(catalogueModule.extractCatalogueCsv(bomZip), sampleCsv);

    // ZIP buffer too small (< 22 bytes)
    assert.throws(
      () => catalogueModule.extractCatalogueCsv(Buffer.alloc(20)),
      /too small/i
    );

    // ZIP exceeds 8MB compressed limit
    assert.throws(
      () => catalogueModule.extractCatalogueCsv(Buffer.alloc(8 * 1024 * 1024 + 1)),
      /exceeds.*8MB/i
    );

    // ZIP64 signature rejection
    const zip64Zip = createZipFixture('list.csv', sampleCsv, { appendZip64: true });
    assert.throws(
      () => catalogueModule.extractCatalogueCsv(zip64Zip),
      /ZIP64.*not supported/i
    );

    // Multi-member / multi-disk ZIP rejection
    const multiEntryZip = createZipFixture('list.csv', sampleCsv, { totalEntries: 2 });
    assert.throws(
      () => catalogueModule.extractCatalogueCsv(multiEntryZip),
      /single member/i
    );

    // Encrypted member rejection
    const encryptedZip = createZipFixture('list.csv', sampleCsv, { flags: 0x0001 });
    assert.throws(
      () => catalogueModule.extractCatalogueCsv(encryptedZip),
      /encrypted/i
    );

    // Unsupported compression method
    const badMethodZip = createZipFixture('list.csv', sampleCsv, { method: 9 });
    assert.throws(
      () => catalogueModule.extractCatalogueCsv(badMethodZip),
      /unsupported compression/i
    );

    // Malicious filenames in ZIP (traversal, slash, non-csv extension)
    for (const badName of ['../secret.csv', 'sub/list.csv', 'list.exe', 'list.csv.bak', 'list\\evil.csv']) {
      const maliciousZip = createZipFixture(badName, sampleCsv, { method: 0 });
      assert.throws(
        () => catalogueModule.extractCatalogueCsv(maliciousZip),
        /unexpected filename/i
      );
    }

    // Invalid signatures
    const badCdSigZip = createZipFixture('list.csv', sampleCsv, { cdSig: 0x11111111 });
    assert.throws(
      () => catalogueModule.extractCatalogueCsv(badCdSigZip),
      /CD signature invalid/i
    );

    const badLhSigZip = createZipFixture('list.csv', sampleCsv, { lhSig: 0x11111111 });
    assert.throws(
      () => catalogueModule.extractCatalogueCsv(badLhSigZip),
      /Local header signature invalid/i
    );

    // Size mismatch
    const sizeMismatchZip = createZipFixture('list.csv', sampleCsv, { uncompSize: 9999 });
    assert.throws(
      () => catalogueModule.extractCatalogueCsv(sizeMismatchZip),
      /size mismatch/i
    );
  }

  // ==========================================
  // 2. parseCatalogueCsv: RFC 4180 CSV parsing
  // ==========================================
  {
    // Basic parsing & required headers validation
    const validCsv = buildCsv([
      { 作品ID: '1001', 作品名: 'タイトル1', 作品名読み: 'タイトルイチ', 分類番号: '913', 文字遣い種別: '新字新仮名', 作品著作権フラグ: 'なし', 姓: '芥川', 名: '龍之介', 姓ローマ字: 'Akutagawa', 名ローマ字: 'Ryunosuke', 役割フラグ: '著者', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000879/files/1001_12345.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
    ]);
    const records = catalogueModule.parseCatalogueCsv(validCsv);
    assert.equal(records.length, 1);
    assert.equal(records[0]['作品ID'], '1001');
    assert.equal(records[0]['作品名'], 'タイトル1');

    // Quoted fields with commas
    const commasCsv = buildCsv([
      { 作品ID: '1002', 作品名: 'タイトル, カンマ入り, テスト' },
    ]);
    const commaRecords = catalogueModule.parseCatalogueCsv(commasCsv);
    assert.equal(commaRecords[0]['作品名'], 'タイトル, カンマ入り, テスト');

    // Quoted fields with escaped quotes
    const quotesCsv = buildCsv([
      { 作品ID: '1003', 作品名: 'タイトル "引用" テスト' },
    ]);
    const quoteRecords = catalogueModule.parseCatalogueCsv(quotesCsv);
    assert.equal(quoteRecords[0]['作品名'], 'タイトル "引用" テスト');

    // Quoted fields with embedded newlines
    const newlinesCsv = buildCsv([
      { 作品ID: '1004', 作品名: '1行目\n2行目\r\n3行目' },
    ]);
    const newlineRecords = catalogueModule.parseCatalogueCsv(newlinesCsv);
    assert.equal(newlineRecords[0]['作品名'], '1行目\n2行目\r\n3行目');

    // Empty input returns []
    const emptyResult = catalogueModule.parseCatalogueCsv('');
    assert.ok(Array.isArray(emptyResult));
    assert.equal(emptyResult.length, 0);

    // Unmatched quote throws
    assert.throws(
      () => catalogueModule.parseCatalogueCsv('作品ID,作品名\n"unclosed'),
      /unmatched quote/i
    );

    // Missing required header throws
    assert.throws(
      () => catalogueModule.parseCatalogueCsv('作品ID,作品名\n1001,テスト'),
      /missing required CSV header/i
    );
  }

  // ==========================================
  // 3. parseCatalogueEntries: grouping & filters
  // ==========================================
  {
    // Multiple contributors grouping, author joining '・', credits '（役割）'
    const groupedCsv = buildCsv([
      { 作品ID: '2001', 作品名: '共同作品', 分類番号: '913', 作品著作権フラグ: 'なし', 姓: '山田', 名: '太郎', 姓ローマ字: 'Yamada', 名ローマ字: 'Taro', 役割フラグ: '著者', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/2001_100.html', 'XHTML/HTMLファイル符号化方式': 'UTF-8' },
      { 作品ID: '2001', 作品名: '共同作品', 分類番号: '913', 作品著作権フラグ: 'なし', 姓: '鈴木', 名: '次郎', 姓ローマ字: 'Suzuki', 名ローマ字: 'Jiro', 役割フラグ: '著者', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/2001_100.html', 'XHTML/HTMLファイル符号化方式': 'UTF-8' },
      { 作品ID: '2001', 作品名: '共同作品', 分類番号: '913', 作品著作権フラグ: 'なし', 姓: '佐藤', 名: '校正', 役割フラグ: '校訂者', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/2001_100.html', 'XHTML/HTMLファイル符号化方式': 'UTF-8' },
    ]);
    const groupedEntries = catalogueModule.parseCatalogueEntries(groupedCsv);
    assert.equal(groupedEntries.length, 1);
    assert.equal(groupedEntries[0].book.slug, 'work-2001');
    assert.equal(groupedEntries[0].book.author, '山田太郎・鈴木次郎');
    assert.equal(groupedEntries[0].book.romanizedAuthor, 'Yamada Taro・Suzuki Jiro');
    assert.equal(groupedEntries[0].book.credits, '佐藤校正（校訂者）');
    assert.equal(groupedEntries[0].encoding, 'utf-8');

    // Copyright filtering: any work flag or person flag != 'なし' excludes entire work
    const copyrightedCsv = buildCsv([
      // Work with work flag 'あり'
      { 作品ID: '2002', 作品名: '著作権あり作品', 分類番号: '913', 作品著作権フラグ: 'あり', 姓: '太宰', 名: '治', 役割フラグ: '著者', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/2002_100.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
      // Work with author person flag 'あり'
      { 作品ID: '2003', 作品名: '人物著作権あり作品', 分類番号: '913', 作品著作権フラグ: 'なし', 姓: '現役', 名: '作家', 役割フラグ: '著者', 人物著作権フラグ: 'あり', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/2003_100.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
      // Work with contributor (translator) person flag 'あり' -> must exclude whole work!
      { 作品ID: '2004', 作品名: '共著者著作権あり', 分類番号: '913', 作品著作権フラグ: 'なし', 姓: '原作者', 名: '故人', 役割フラグ: '著者', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/2004_100.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
      { 作品ID: '2004', 作品名: '共著者著作権あり', 分類番号: '913', 作品著作権フラグ: 'なし', 姓: '翻訳', 名: '現役', 役割フラグ: '翻訳者', 人物著作権フラグ: 'あり', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/2004_100.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
      // Clean work -> included
      { 作品ID: '2005', 作品名: 'パブリックドメイン作品', 分類番号: '913', 作品著作権フラグ: 'なし', 姓: '夏目', 名: '漱石', 役割フラグ: '著者', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/2005_100.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
    ]);
    const filteredEntries = catalogueModule.parseCatalogueEntries(copyrightedCsv);
    assert.equal(filteredEntries.length, 1);
    assert.equal(filteredEntries[0].book.slug, 'work-2005');

    // NDC classification: Japanese fiction (913 or K913) included; others excluded
    const ndcCsv = buildCsv([
      { 作品ID: '3001', 作品名: '小説913', 分類番号: 'NDC 913.6', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/3001_1.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
      { 作品ID: '3002', 作品名: '童話K913', 分類番号: 'K913', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/3002_1.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
      { 作品ID: '3003', 作品名: '随筆914', 分類番号: 'NDC 914', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/3003_1.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
      { 作品ID: '3004', 作品名: '外国文学933', 分類番号: 'NDC 933', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/3004_1.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
    ]);
    const ndcEntries = catalogueModule.parseCatalogueEntries(ndcCsv);
    assert.equal(ndcEntries.length, 2);
    const work3001 = ndcEntries.find((e) => e.book.slug === 'work-3001');
    const work3002 = ndcEntries.find((e) => e.book.slug === 'work-3002');
    assert.ok(work3001 && work3002);
    assert.equal(work3001.book.category, 'Truyện Nhật');
    assert.equal(work3002.book.category, 'Truyện thiếu nhi');

    // XHTML URL validation
    const urlCsv = buildCsv([
      // Valid https URL with padded work ID
      { 作品ID: '4001', 作品名: '正当URL', 分類番号: '913', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000123/files/004001_1.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
      // Valid http URL normalized to https
      { 作品ID: '4002', 作品名: 'HTTP正規化', 分類番号: '913', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'http://www.aozora.gr.jp/cards/000123/files/4002_1.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
      // Malicious URL with credentials (@)
      { 作品ID: '4003', 作品名: '不正URLアット', 分類番号: '913', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://user:pass@www.aozora.gr.jp/cards/000123/files/4003_1.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
      // Malicious URL with query / fragment
      { 作品ID: '4004', 作品名: '不正クエリ', 分類番号: '913', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000123/files/4004_1.html?token=leak', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
      // Malicious URL with directory traversal
      { 作品ID: '4005', 作品名: '不正トラバーサル', 分類番号: '913', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000123/files/../4005_1.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
      // Malicious URL with foreign host
      { 作品ID: '4006', 作品名: '偽ホスト', 分類番号: '913', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://attacker.com/cards/000123/files/4006_1.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
      // Work ID mismatch in filename (ID 4007 vs file 9999_1.html)
      { 作品ID: '4007', 作品名: 'ID不一致', 分類番号: '913', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000123/files/9999_1.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
    ]);
    const validUrlEntries = catalogueModule.parseCatalogueEntries(urlCsv);
    assert.equal(validUrlEntries.length, 2);
    assert.equal(validUrlEntries.find((e) => e.book.slug === 'work-4001')?.url, 'https://www.aozora.gr.jp/cards/000123/files/004001_1.html');
    assert.equal(validUrlEntries.find((e) => e.book.slug === 'work-4002')?.url, 'https://www.aozora.gr.jp/cards/000123/files/4002_1.html');

    // Encoding normalization: shift_jis and utf-8 accepted; others rejected
    const encCsv = buildCsv([
      { 作品ID: '5001', 作品名: 'SJIS1', 分類番号: '913', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/5001_1.html', 'XHTML/HTMLファイル符号化方式': 'Shift_JIS' },
      { 作品ID: '5002', 作品名: 'SJIS2', 分類番号: '913', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/5002_1.html', 'XHTML/HTMLファイル符号化方式': 'sjis' },
      { 作品ID: '5003', 作品名: 'UTF8', 分類番号: '913', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/5003_1.html', 'XHTML/HTMLファイル符号化方式': 'UTF-8' },
      { 作品ID: '5004', 作品名: 'EUC', 分類番号: '913', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/5004_1.html', 'XHTML/HTMLファイル符号化方式': 'EUC-JP' },
    ]);
    const encEntries = catalogueModule.parseCatalogueEntries(encCsv);
    assert.equal(encEntries.length, 3);
    assert.equal(encEntries.find((e) => e.book.slug === 'work-5001')?.encoding, 'shift_jis');
    assert.equal(encEntries.find((e) => e.book.slug === 'work-5002')?.encoding, 'shift_jis');
    assert.equal(encEntries.find((e) => e.book.slug === 'work-5003')?.encoding, 'utf-8');

    // Curated 13 works alias mapping and metadata preservation
    const curatedCsv = buildCsv([
      // Work 4719 = kyonen-no-ki
      { 作品ID: '4719', 作品名: '去年の木', 作品名読み: 'きょねんのき', 分類番号: '913', 文字遣い種別: '新字新仮名', 作品著作権フラグ: 'なし', 姓: '新美', 名: '南吉', 姓ローマ字: 'Niimi', 名ローマ字: 'Nankichi', 役割フラグ: '著者', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000121/files/4719_13221.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
      // Duplicate row for deduplication test
      { 作品ID: '4719', 作品名: '去年の木', 作品名読み: 'きょねんのき', 分類番号: '913', 文字遣い種別: '新字新仮名', 作品著作権フラグ: 'なし', 姓: '新美', 名: '南吉', 姓ローマ字: 'Niimi', 名ローマ字: 'Nankichi', 役割フラグ: '著者', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000121/files/4719_13221.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
    ]);
    const curatedEntries = catalogueModule.parseCatalogueEntries(curatedCsv);
    assert.equal(curatedEntries.length, 1, 'Duplicate curated entries must deduplicate');
    assert.equal(curatedEntries[0].book.slug, 'kyonen-no-ki');
    assert.equal(curatedEntries[0].book.title, 'Cái cây năm ngoái');
    assert.ok(curatedEntries[0].book.intro.length > 0);
    assert.equal(curatedEntries[0].book.orthography, '新字新仮名');
    assert.equal(curatedEntries[0].book.titleReading, 'きょねんのき');

    // No fake minutes / translation on dynamic works
    const dynamicCsv = buildCsv([
      { 作品ID: '6001', 作品名: '動的作品', 分類番号: '913', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/6001_1.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
    ]);
    const [dynamicEntry] = catalogueModule.parseCatalogueEntries(dynamicCsv);
    assert.equal(dynamicEntry.book.slug, 'work-6001');
    assert.equal(dynamicEntry.book.minutes, undefined);
    assert.equal(dynamicEntry.book.intro, '');
    assert.equal(dynamicEntry.book.excerpt, '');

    // Max 6-digit ID validation (e.g. 7-digit ID rejected)
    const oversizeIdCsv = buildCsv([
      { 作品ID: '1234567', 作品名: '7桁ID', 分類番号: '913', 作品著作権フラグ: 'なし', 人物著作権フラグ: 'なし', 'XHTML/HTMLファイルURL': 'https://www.aozora.gr.jp/cards/000001/files/1234567_1.html', 'XHTML/HTMLファイル符号化方式': 'ShiftJIS' },
    ]);
    assert.equal(catalogueModule.parseCatalogueEntries(oversizeIdCsv).length, 0);
  }

  // ==========================================
  // 4. Bundled Snapshot & findCatalogueBook
  // ==========================================
  {
    const catalogue = await catalogueModule.getBookCatalogue();
    assert.ok(Array.isArray(catalogue), 'Catalogue must be an array');
    assert.ok(catalogue.length >= 6000, `Bundled catalogue must have >= 6000 works (got ${catalogue.length})`);

    // Verify metadata public shape: no source URLs leaked in Book object
    for (const entry of catalogue.slice(0, 50)) {
      assert.ok(entry.book.slug);
      assert.ok(entry.book.title);
      assert.ok(entry.book.japaneseTitle);
      assert.ok(entry.book.author);
      assert.ok(entry.url.startsWith('https://www.aozora.gr.jp/'));
      assert.ok(entry.encoding === 'shift_jis' || entry.encoding === 'utf-8');
      assert.equal((entry.book).url, undefined, 'Book object must not leak source url');
      assert.equal((entry.book).encoding, undefined, 'Book object must not leak encoding');
    }

    // Curated book lookup
    const kyonen = await catalogueModule.findCatalogueBook('kyonen-no-ki');
    assert.ok(kyonen);
    assert.equal(kyonen.book.slug, 'kyonen-no-ki');
    assert.equal(kyonen.book.japaneseTitle, '去年の木');

    // Bidirectional alias lookup: work-4719 resolves to kyonen-no-ki
    const byWorkId = await catalogueModule.findCatalogueBook('work-4719');
    assert.ok(byWorkId);
    assert.equal(byWorkId.book.slug, 'kyonen-no-ki');

    // Dynamic work lookup
    const sampleDynamic = catalogue.find((e) => e.book.slug.startsWith('work-'));
    assert.ok(sampleDynamic, 'Should contain dynamic works');
    const foundDynamic = await catalogueModule.findCatalogueBook(sampleDynamic.book.slug);
    assert.ok(foundDynamic);
    assert.equal(foundDynamic.book.slug, sampleDynamic.book.slug);

    // Unknown slug / prototype pollution / directory traversal
    for (const badSlug of [
      'unknown-slug',
      '__proto__',
      'constructor',
      'toString',
      '../../etc/passwd',
      'work-abc',
      'work-1234567',
      'https://attacker.com',
      '',
      null,
      undefined,
    ]) {
      const result = await catalogueModule.findCatalogueBook(badSlug);
      assert.equal(result, undefined, `Slug '${badSlug}' must return undefined`);
    }
  }

  // ==========================================
  // 5. searchBookCatalogue: filters & pages
  // ==========================================
  {
    // Slugs filtering & alias expansion
    const slugSearchResult = await catalogueModule.searchBookCatalogue({
      slugs: ['kyonen-no-ki', 'work-4718'], // 4718 is nihiki-no-kaeru
    });
    assert.equal(slugSearchResult.books.length, 2);
    const resultSlugs = slugSearchResult.books.map((b) => b.slug);
    assert.ok(resultSlugs.includes('kyonen-no-ki'));
    assert.ok(resultSlugs.includes('nihiki-no-kaeru'));

    const catalogue = await catalogueModule.getBookCatalogue();
    const fifty = catalogue.slice(0, 50).map((entry) => entry.book.slug);
    assert.equal((await catalogueModule.searchBookCatalogue({ slugs: fifty })).books.length, 50, 'Saved batches must not be truncated to a 24-item page');
    assert.equal((await catalogueModule.searchBookCatalogue({ slugs: [] })).total, 0);
    const chapters = catalogue.filter((entry) => entry.book.title.startsWith('源氏物語 — '));
    assert.ok(chapters.length > 10);
    assert.ok(new Set(chapters.map((entry) => entry.book.title)).size > 10, 'Chapter subtitles distinguish similarly named works');

    // Slugs limit (> 50 slugs throws)
    const fiftyOneSlugs = Array.from({ length: 51 }, (_, i) => `work-${i + 1}`);
    await assert.rejects(
      () => catalogueModule.searchBookCatalogue({ slugs: fiftyOneSlugs }),
      /too many slugs/i
    );

    // Category filter
    const childrenResult = await catalogueModule.searchBookCatalogue({
      category: 'Truyện thiếu nhi',
    });
    assert.ok(childrenResult.books.length > 0);
    assert.ok(childrenResult.books.every((b) => b.category === 'Truyện thiếu nhi'));

    // Author filter (NFKC and kana-case insensitive)
    const authorResult = await catalogueModule.searchBookCatalogue({
      author: 'Akutagawa',
    });
    assert.ok(authorResult.books.length > 0);
    assert.ok(authorResult.books.every((b) => b.author.includes('芥川') || b.romanizedAuthor?.toLowerCase().includes('akutagawa')));

    // Query q filter matching title reading / kana
    const qResult = await catalogueModule.searchBookCatalogue({
      q: 'メロス',
    });
    assert.ok(qResult.books.length > 0);
    assert.ok(qResult.books.some((b) => b.japaneseTitle.includes('メロス') || b.title.includes('Melos')));

    // Pagination: page 1 vs page 2
    const p1 = await catalogueModule.searchBookCatalogue({ page: 1 });
    const p2 = await catalogueModule.searchBookCatalogue({ page: 2 });
    assert.equal(p1.page, 1);
    assert.equal(p2.page, 2);
    assert.equal(p1.books.length, 24);
    assert.equal(p2.books.length, 24);
    assert.notEqual(p1.books[0].slug, p2.books[0].slug, 'Page 1 and Page 2 must not have identical first item');
    assert.equal(p1.total, p2.total);
    assert.equal(p1.pages, p2.pages);

    // Authors aggregation: max 20, sorted descending by count
    assert.ok(p1.authors.length <= 20);
    for (let i = 1; i < p1.authors.length; i++) {
      assert.ok(p1.authors[i - 1].count >= p1.authors[i].count);
    }

    // Categories aggregation: non-empty
    assert.ok(p1.categories.length > 0);
  }

  // ==========================================
  // 6. Background refresh & fallback retention
  // ==========================================
  {
    // When upstream refresh fails or returns empty, last-good snapshot must be retained
    let fetchCallCount = 0;
    const tasks = [];
    const failingCatalogueModule = loadModule('src/lib/bookCatalogue.ts', async () => {
      fetchCallCount++;
      return new Response('Unavailable', { status: 503 });
    }, { 'next/server': { after: (task) => tasks.push(task) } });
    const fallbackCatalogue = await failingCatalogueModule.getBookCatalogue();
    assert.ok(fallbackCatalogue.length >= 6000);
    await failingCatalogueModule.getBookCatalogue();
    assert.equal(tasks.length, 1, 'Concurrent requests schedule one refresh');
    await tasks[0]();
    assert.equal(fetchCallCount, 1);
    assert.equal((await failingCatalogueModule.getBookCatalogue()).length, fallbackCatalogue.length, 'Retain snapshot on refresh failure');
    assert.equal(tasks.length, 1, 'Failed refresh is throttled');
    const standalone = loadModule('src/lib/bookCatalogue.ts', undefined, { 'next/server': { after() { throw new Error('No request scope'); } } });
    assert.ok((await standalone.getBookCatalogue()).length >= 6000, 'Standalone context must not reject the snapshot');
  }

  // ==========================================
  // 7. API Route: src/app/api/books/route.ts
  // ==========================================
  {
    const routeModule = loadModule('src/app/api/books/route.ts', undefined, {
      '@/lib/bookCatalogue': catalogueModule,
      '@/lib/bookCovers': { getBookCoverUrls: async () => ({}) },
      '@/data/books': { books: [] },
    });

    // Valid query -> 200 with cache headers
    const req200 = new Request('http://localhost/api/books?q=test&page=1');
    const res200 = await routeModule.GET(req200);
    assert.equal(res200.status, 200);
    assert.equal(res200.headers.get('cache-control'), 'public, max-age=60, s-maxage=3600');
    const body200 = await res200.json();
    assert.ok(Array.isArray(body200.books));
    assert.equal(typeof body200.total, 'number');

    // Exact boundaries (q=120, author=120, category=80, slugs=50, page=10000) -> 200
    const boundarySlugs = Array.from({ length: 50 }, (_, i) => `work-${i + 1}`).join(',');
    const reqBoundaries = new Request(
      `http://localhost/api/books?q=${'a'.repeat(120)}&author=${'b'.repeat(120)}&category=${'c'.repeat(80)}&page=10000&slugs=${boundarySlugs}`
    );
    const resBoundaries = await routeModule.GET(reqBoundaries);
    assert.equal(resBoundaries.status, 200, 'Boundary limits (120, 120, 80, 10000, 50) must be accepted');

    // q > 120 chars -> 400
    const reqQTooLong = new Request(`http://localhost/api/books?q=${'a'.repeat(121)}`);
    const resQTooLong = await routeModule.GET(reqQTooLong);
    assert.equal(resQTooLong.status, 400);
    assert.match(resQTooLong.headers.get('cache-control') || '', /no-store/);

    // author > 120 chars -> 400
    const reqAuthorTooLong = new Request(`http://localhost/api/books?author=${'a'.repeat(121)}`);
    const resAuthorTooLong = await routeModule.GET(reqAuthorTooLong);
    assert.equal(resAuthorTooLong.status, 400);

    // category > 80 chars -> 400
    const reqCatTooLong = new Request(`http://localhost/api/books?category=${'a'.repeat(81)}`);
    const resCatTooLong = await routeModule.GET(reqCatTooLong);
    assert.equal(resCatTooLong.status, 400);

    // page invalid: 0, negative, non-numeric, > 10000 -> 400
    for (const badPage of ['0', '-1', 'abc', '10001']) {
      const reqBadPage = new Request(`http://localhost/api/books?page=${badPage}`);
      const resBadPage = await routeModule.GET(reqBadPage);
      assert.equal(resBadPage.status, 400, `Page '${badPage}' must return 400`);
    }

    // slugs > 50 -> 400
    const reqTooManySlugs = new Request(`http://localhost/api/books?slugs=${Array.from({ length: 51 }, (_, i) => `work-${i}`).join(',')}`);
    const resTooManySlugs = await routeModule.GET(reqTooManySlugs);
    assert.equal(resTooManySlugs.status, 400);

    // Upstream error -> 503 with no-store
    const failingRoute = loadModule('src/app/api/books/route.ts', undefined, {
      '@/lib/bookCatalogue': {
        searchBookCatalogue: async () => {
          throw new Error('Database / Network failure');
        },
      },
      '@/lib/bookCovers': { getBookCoverUrls: async () => ({}) },
      '@/data/books': { books: [] },
    });
    const reqFail = new Request('http://localhost/api/books');
    const resFail = await failingRoute.GET(reqFail);
    assert.equal(resFail.status, 503);
    assert.match(resFail.headers.get('cache-control') || '', /no-store/);
  }

  // ==========================================
  // 8. Optional TEMP CSV real file check
  // ==========================================
  {
    const tempCsvPath = 'C:\\Users\\Slim5\\AppData\\Local\\Temp\\opencode\\catalogue.csv';
    if (fs.existsSync(tempCsvPath)) {
      const stats = fs.statSync(tempCsvPath);
      assert.ok(stats.size > 10_000_000, `Expected temp CSV > 10MB, got ${stats.size} bytes`);
      // Read header + first 100 lines for validation
      const fd = fs.openSync(tempCsvPath, 'r');
      const sampleBuf = Buffer.alloc(65536);
      fs.readSync(fd, sampleBuf, 0, 65536, 0);
      fs.closeSync(fd);
      const sampleText = sampleBuf.toString('utf8');
      const lines = sampleText.split(/\r?\n/);
      const cleanSlice = lines.slice(0, Math.min(lines.length - 1, 30)).join('\r\n');
      const sampleRecords = catalogueModule.parseCatalogueCsv(cleanSlice);
      assert.ok(sampleRecords.length > 0, 'Real temp CSV must parse successfully');
      const sampleEntries = catalogueModule.parseCatalogueEntries(cleanSlice);
      assert.ok(Array.isArray(sampleEntries), 'Real temp CSV entries must parse');
    }
  }

  console.log('PASS: book catalogue extraction, CSV parsing, copyright filtering, NDC classification, URL validation, search/pagination, snapshot fallback, API statuses.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
