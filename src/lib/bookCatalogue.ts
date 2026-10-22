import 'server-only';
import { inflateRawSync } from 'node:zlib';
import { after } from 'next/server';
import { getBook, type Book } from '@/data/books';
import snapshot from '@/data/book-catalogue.json';

// ponytail: each server instance refreshes its own metadata cache; add shared cache only when multi-instance freshness needs coordination.

export type CatalogueEntry = {
  book: Book;
  url: string;
  encoding: string;
};

const OFFICIAL_AOZORA_ZIP_URL = 'https://www.aozora.gr.jp/index_pages/list_person_all_extended_utf8.zip';
const MAX_COMPRESSED_BYTES = 8 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RETRY_INTERVAL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 240_000;
const PAGE_SIZE = 24;

const CURATED_WORK_MAP: Readonly<Record<number, string>> = {
  4719: 'kyonen-no-ki',
  4718: 'nihiki-no-kaeru',
  4723: 'amedama',
  628: 'gon-gitsune',
  637: 'tebukuro-o-kai-ni',
  43754: 'chumon-no-ooi-ryoriten',
  95: 'majutsu',
  18376: 'momotaro',
  1567: 'hashire-merosu',
  43016: 'torokko',
  42: 'hana',
  43014: 'aguni-no-kami',
  462: 'kaze-no-matasaburo',
};

const REVERSE_CURATED_WORK_MAP: Readonly<Record<string, number>> = Object.fromEntries(
  Object.entries(CURATED_WORK_MAP).map(([id, slug]) => [slug, Number(id)])
);

const CURATED_SLUG_SET = new Set<string>(Object.values(CURATED_WORK_MAP));

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
] as const;

const NDC_FICTION_REGEX = /(?:^|[^\w])(?:NDC\s*)?K?\s*913(?:\.\d+)?(?:[^\w]|$)/i;
const NDC_CHILDREN_REGEX = /(?:^|[^\w])(?:NDC\s*)?K\s*913(?:\.\d+)?(?:[^\w]|$)/i;
const WORK_SLUG_REGEX = /^work-[1-9]\d{0,5}$/;

export function extractCatalogueCsv(zipBuffer: Buffer | Uint8Array): string {
  const buf = Buffer.isBuffer(zipBuffer)
    ? zipBuffer
    : Buffer.from(zipBuffer.buffer, zipBuffer.byteOffset, zipBuffer.byteLength);

  if (buf.length > MAX_COMPRESSED_BYTES) throw new Error('ZIP exceeds 8MB compressed limit');
  if (buf.length < 22) throw new Error('ZIP buffer too small');

  for (let i = 0; i <= buf.length - 4; i++) {
    const sig = buf.readUInt32LE(i);
    if (sig === 0x07064b50 || sig === 0x06064b50) throw new Error('ZIP64 not supported');
  }

  let eocd = -1;
  const maxSearch = Math.min(buf.length - 22, 65535 + 22);
  const minOffset = Math.max(0, buf.length - maxSearch);
  for (let i = buf.length - 22; i >= minOffset; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      if (i + 22 + buf.readUInt16LE(i + 20) === buf.length) {
        eocd = i;
        break;
      }
    }
  }

  if (eocd === -1) throw new Error('EOCD record not found');
  if (buf.readUInt16LE(eocd + 4) !== 0 || buf.readUInt16LE(eocd + 6) !== 0) throw new Error('Multi-disk not supported');
  if (buf.readUInt16LE(eocd + 8) !== 1 || buf.readUInt16LE(eocd + 10) !== 1) {
    throw new Error('ZIP must contain single member');
  }

  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  if (cdOffset + cdSize > eocd) throw new Error('CD bounds invalid');
  if (buf.readUInt32LE(cdOffset) !== 0x02014b50) throw new Error('CD signature invalid');

  const flags = buf.readUInt16LE(cdOffset + 8);
  if ((flags & 0x0001) !== 0 || (flags & 0x0040) !== 0) throw new Error('Encrypted ZIP rejected');

  const method = buf.readUInt16LE(cdOffset + 10);
  if (method !== 0 && method !== 8) throw new Error(`Unsupported compression: ${method}`);

  const compSize = buf.readUInt32LE(cdOffset + 20);
  const uncompSize = buf.readUInt32LE(cdOffset + 24);
  const fnLen = buf.readUInt16LE(cdOffset + 28);
  const locOffset = buf.readUInt32LE(cdOffset + 42);

  if (compSize > MAX_COMPRESSED_BYTES) throw new Error('Compressed size exceeds 8MB');
  if (uncompSize > MAX_UNCOMPRESSED_BYTES) throw new Error('Uncompressed size exceeds 64MB');

  const filename = buf.toString('utf8', cdOffset + 46, cdOffset + 46 + fnLen);
  if (!/^[\w.-]+\.csv$/i.test(filename) || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    throw new Error(`Unexpected filename: ${filename}`);
  }

  if (locOffset + 30 > buf.length || buf.readUInt32LE(locOffset) !== 0x04034b50) {
    throw new Error('Local header signature invalid');
  }

  const locNameLen = buf.readUInt16LE(locOffset + 26);
  const locExtraLen = buf.readUInt16LE(locOffset + 28);
  const dataOffset = locOffset + 30 + locNameLen + locExtraLen;
  const dataEnd = dataOffset + compSize;
  if (dataEnd > buf.length) throw new Error('Compressed slice extends beyond buffer');

  const compressedSlice = buf.subarray(dataOffset, dataEnd);
  const uncompressed = method === 0 ? compressedSlice : inflateRawSync(compressedSlice, { maxOutputLength: MAX_UNCOMPRESSED_BYTES });
  if (uncompressed.length !== uncompSize) throw new Error('Uncompressed size mismatch');

  return new TextDecoder('utf-8', { fatal: true }).decode(uncompressed).replace(/^\uFEFF/, '');
}

export function parseCatalogueCsv(csvText: string): Record<string, string>[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csvText[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentField);
      currentField = '';
    } else if (ch === '\r') {
      if (csvText[i + 1] === '\n') i++;
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.length > 1 || currentRow[0] !== '') rows.push(currentRow);
      currentRow = [];
    } else if (ch === '\n') {
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.length > 1 || currentRow[0] !== '') rows.push(currentRow);
      currentRow = [];
    } else {
      currentField += ch;
    }
  }

  if (inQuotes) throw new Error('Unmatched quote in CSV');
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.length > 1 || currentRow[0] !== '') rows.push(currentRow);
  }

  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim().replace(/^\uFEFF/, ''));
  const headerSet = new Set(headers);
  for (const required of REQUIRED_HEADERS) {
    if (!headerSet.has(required)) throw new Error(`Missing required CSV header: ${required}`);
  }

  const records: Record<string, string>[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = row[j] ?? '';
    }
    records.push(record);
  }

  return records;
}

export function parseCatalogueEntries(csvText: string): CatalogueEntry[] {
  const records = parseCatalogueCsv(csvText);

  // Group ALL rows by numeric 作品ID (max 6 digits) FIRST
  const groupedByWork = new Map<number, Record<string, string>[]>();
  for (const record of records) {
    const rawId = record['作品ID']?.trim();
    if (!rawId || !/^\d{1,6}$/.test(rawId)) continue;
    const workId = Number(rawId);
    let group = groupedByWork.get(workId);
    if (!group) {
      group = [];
      groupedByWork.set(workId, group);
    }
    group.push(record);
  }

  const entries: CatalogueEntry[] = [];

  for (const [workId, rows] of groupedByWork.entries()) {
    // Exclude if any work/person rights not 'なし'
    const hasCopyright = rows.some((r) => r['作品著作権フラグ']?.trim() !== 'なし' || r['人物著作権フラグ']?.trim() !== 'なし');
    if (hasCopyright) continue;

    // Filter Japanese fiction NDC913 or K913
    const ndc = rows.find((r) => r['分類番号'])?.['分類番号']?.trim() ?? '';
    if (!NDC_FICTION_REGEX.test(ndc)) continue;
    const isK913 = NDC_CHILDREN_REGEX.test(ndc);

    // XHTML URL validation
    const urlRow = rows.find((r) => r['XHTML/HTMLファイルURL']);
    if (!urlRow) continue;
    let rawUrl = (urlRow['XHTML/HTMLファイルURL'] || '').trim();
    if (!rawUrl || rawUrl.includes('@') || rawUrl.includes('?') || rawUrl.includes('#') || rawUrl.includes('..')) continue;
    if (rawUrl.startsWith('http://www.aozora.gr.jp/')) {
      rawUrl = 'https://www.aozora.gr.jp/' + rawUrl.slice('http://www.aozora.gr.jp/'.length);
    }

    const urlMatch = rawUrl.match(/^https:\/\/www\.aozora\.gr\.jp\/cards\/(\d{6})\/files\/([\w.-]+\.html?)$/i);
    if (!urlMatch) continue;

    const filename = urlMatch[2];
    const numIdStr = String(workId);
    const paddedIdStr = numIdStr.padStart(6, '0');
    const isMatchingWorkId =
      filename.startsWith(`${numIdStr}_`) ||
      filename.startsWith(`${paddedIdStr}_`) ||
      filename === `${numIdStr}.html` ||
      filename === `${paddedIdStr}.html` ||
      filename === `${numIdStr}.htm` ||
      filename === `${paddedIdStr}.htm`;
    if (!isMatchingWorkId) continue;

    const rawEncoding = (urlRow['XHTML/HTMLファイル符号化方式'] || '').trim();
    let normalizedEncoding: string;
    if (/^shift[_-]?jis$/i.test(rawEncoding) || /^sjis$/i.test(rawEncoding)) {
      normalizedEncoding = 'shift_jis';
    } else if (/^utf-?8$/i.test(rawEncoding)) {
      normalizedEncoding = 'utf-8';
    } else {
      continue;
    }

    const firstRow = rows[0];
    const mainTitle = firstRow['作品名']?.trim() || '';
    if (!mainTitle) continue;
    const subtitle = firstRow['副題']?.trim();
    const sourceTitle = subtitle ? `${mainTitle} — ${subtitle}` : mainTitle;

    const titleReading = firstRow['作品名読み']?.trim() || undefined;
    const orthography = firstRow['文字遣い種別']?.trim() || undefined;

    const authorRows = rows.filter((r) => r['役割フラグ']?.trim() === '著者');
    let author = '';
    let romanizedAuthor = '';

    if (authorRows.length > 0) {
      author = authorRows.map((r) => `${r['姓']?.trim() || ''}${r['名']?.trim() || ''}`.trim()).filter(Boolean).join('・');
      romanizedAuthor = authorRows
        .map((r) => [r['姓ローマ字']?.trim(), r['名ローマ字']?.trim()].filter(Boolean).join(' '))
        .filter(Boolean)
        .join('・');
    } else {
      author = `${firstRow['姓']?.trim() || ''}${firstRow['名']?.trim() || ''}`.trim();
      romanizedAuthor = [firstRow['姓ローマ字']?.trim(), firstRow['名ローマ字']?.trim()].filter(Boolean).join(' ');
    }

    const contributorRows = rows.filter((r) => {
      const role = r['役割フラグ']?.trim();
      return role && role !== '著者';
    });
    const credits = contributorRows.length > 0
      ? contributorRows
          .map((r) => `${`${r['姓']?.trim() || ''}${r['名']?.trim() || ''}`.trim()}（${r['役割フラグ']?.trim()}）`)
          .filter(Boolean)
          .join('、')
      : undefined;

    const curatedSlug = CURATED_WORK_MAP[workId];
    let book: Book;

    if (curatedSlug) {
      const curated = getBook(curatedSlug);
      book = curated
        ? {
            ...curated,
            ...(orthography ? { orthography } : {}),
            ...(titleReading ? { titleReading } : {}),
            ...(credits ? { credits } : {}),
          }
        : {
            slug: curatedSlug,
            title: sourceTitle,
            japaneseTitle: sourceTitle,
            author,
            romanizedAuthor,
            category: isK913 ? 'Truyện thiếu nhi' : 'Truyện Nhật',
            intro: '',
            excerpt: '',
            orthography,
            titleReading,
            credits,
          };
    } else {
      book = {
        slug: `work-${workId}`,
        title: sourceTitle,
        japaneseTitle: sourceTitle,
        author,
        romanizedAuthor,
        category: isK913 ? 'Truyện thiếu nhi' : 'Truyện Nhật',
        intro: '',
        excerpt: '',
        orthography,
        titleReading,
        credits,
      };
    }

    entries.push({ book, url: rawUrl, encoding: normalizedEncoding });
  }

  const seenSlugs = new Set<string>();
  const dedupedEntries: CatalogueEntry[] = [];
  for (const entry of entries) {
    if (!seenSlugs.has(entry.book.slug)) {
      seenSlugs.add(entry.book.slug);
      dedupedEntries.push(entry);
    }
  }

  dedupedEntries.sort((a, b) => compareBooksJapanese(a.book, b.book));
  return dedupedEntries;
}

function compareBooksJapanese(a: Book, b: Book): number {
  const readingA = a.titleReading || a.japaneseTitle;
  const readingB = b.titleReading || b.japaneseTitle;
  const readingCmp = readingA.localeCompare(readingB, 'ja');
  if (readingCmp !== 0) return readingCmp;
  const titleCmp = a.japaneseTitle.localeCompare(b.japaneseTitle, 'ja');
  if (titleCmp !== 0) return titleCmp;
  return a.slug.localeCompare(b.slug);
}

function normalizeForSearch(text: string): string {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u30a1-\u30f6]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

async function fetchCatalogueZip(): Promise<Buffer> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(OFFICIAL_AOZORA_ZIP_URL, {
      redirect: 'error',
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Upstream catalogue fetch failed: ${res.status}`);

    const contentLengthHeader = res.headers.get('content-length');
    if (contentLengthHeader && parseInt(contentLengthHeader, 10) > MAX_COMPRESSED_BYTES) {
      throw new Error('Upstream catalogue content-length exceeds 8MB limit');
    }

    if (!res.body) throw new Error('Empty upstream response body');
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        totalBytes += value.length;
        if (totalBytes > MAX_COMPRESSED_BYTES) {
          controller.abort();
          throw new Error('Upstream catalogue exceeds 8MB stream limit');
        }
        chunks.push(value);
      }
    }

    return Buffer.concat(chunks);
  } finally {
    clearTimeout(timeoutId);
  }
}

const bundledSnapshot: CatalogueEntry[] = Array.isArray(snapshot) ? (snapshot as CatalogueEntry[]) : [];

let memoryCache: CatalogueEntry[] = bundledSnapshot;
let lastSuccessTimestamp = 0;
let lastAttemptTimestamp = 0;
let inFlightPromise: Promise<CatalogueEntry[]> | null = null;

async function refreshCatalogue(): Promise<CatalogueEntry[]> {
  lastAttemptTimestamp = Date.now();
  const zipBuffer = await fetchCatalogueZip();
  const csvText = extractCatalogueCsv(zipBuffer);
  const entries = parseCatalogueEntries(csvText);
  if (entries.length === 0) {
    throw new Error('Parsed catalogue returned 0 entries; retaining snapshot');
  }
  memoryCache = entries;
  lastSuccessTimestamp = Date.now();
  return entries;
}

function triggerBackgroundRefresh(): void {
  if (inFlightPromise) return;

  // Throttle before scheduling so concurrent requests share the last-good snapshot.
  lastAttemptTimestamp = Date.now();
  try {
    after(async () => {
      try { await refreshCatalogue(); } catch { /* Retain last-good metadata. */ }
    });
  } catch { /* Standalone scripts have no Next request lifecycle. */ }
}

export async function getBookCatalogue(): Promise<CatalogueEntry[]> {
  const now = Date.now();

  if (memoryCache.length > 0) {
    const shouldRefresh =
      (lastSuccessTimestamp === 0 && now - lastAttemptTimestamp > RETRY_INTERVAL_MS) ||
      (now - lastSuccessTimestamp > REFRESH_INTERVAL_MS && now - lastAttemptTimestamp > RETRY_INTERVAL_MS);

    if (shouldRefresh) {
      triggerBackgroundRefresh();
    }
    return memoryCache;
  }

  if (inFlightPromise) return inFlightPromise;
  inFlightPromise = refreshCatalogue().finally(() => {
    inFlightPromise = null;
  });
  return inFlightPromise;
}

export async function findCatalogueBook(slug: string): Promise<CatalogueEntry | undefined> {
  if (!slug || typeof slug !== 'string') return undefined;
  if (!CURATED_SLUG_SET.has(slug) && !WORK_SLUG_REGEX.test(slug)) return undefined;

  const catalogue = await getBookCatalogue();
  const direct = catalogue.find((entry) => entry.book.slug === slug);
  if (direct) return direct;

  if (slug.startsWith('work-')) {
    const id = Number(slug.slice(5));
    const curatedAlias = CURATED_WORK_MAP[id];
    if (curatedAlias) return catalogue.find((entry) => entry.book.slug === curatedAlias);
  }

  const workId = REVERSE_CURATED_WORK_MAP[slug];
  if (workId) {
    return catalogue.find((entry) => entry.book.slug === `work-${workId}`);
  }

  return undefined;
}

export async function searchBookCatalogue({
  q,
  author,
  category,
  page = 1,
  slugs,
}: {
  q?: string;
  author?: string;
  category?: string;
  page?: number;
  slugs?: string[];
}): Promise<{
  books: Book[];
  total: number;
  page: number;
  pages: number;
  authors: { name: string; count: number }[];
  categories: { name: string; count: number }[];
}> {
  if (slugs && slugs.length > 50) {
    throw new Error('Too many slugs: maximum 50 allowed');
  }

  const catalogue = await getBookCatalogue();

  const categoryCounts = new Map<string, number>();
  for (const entry of catalogue) {
    const cat = entry.book.category;
    if (cat) categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }
  const categories = Array.from(categoryCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'vi'));

  let filtered = catalogue;

  if (slugs) {
    const targetSlugs = new Set<string>(slugs);
    for (const s of slugs) {
      if (s.startsWith('work-')) {
        const id = Number(s.slice(5));
        const alias = CURATED_WORK_MAP[id];
        if (alias) targetSlugs.add(alias);
      } else {
        const workId = REVERSE_CURATED_WORK_MAP[s];
        if (workId) targetSlugs.add(`work-${workId}`);
      }
    }
    filtered = filtered.filter((e) => targetSlugs.has(e.book.slug));
  }

  if (category) {
    filtered = filtered.filter((e) => e.book.category === category);
  }

  if (author) {
    const normAuthor = normalizeForSearch(author);
    filtered = filtered.filter((e) => {
      const normBookAuthor = normalizeForSearch(e.book.author);
      const normRoman = normalizeForSearch(e.book.romanizedAuthor);
      return normBookAuthor.includes(normAuthor) || normRoman.includes(normAuthor);
    });
  }

  if (q) {
    const normQ = normalizeForSearch(q);
    filtered = filtered.filter((e) => {
      const titleMatch = normalizeForSearch(e.book.title).includes(normQ);
      const jpTitleMatch = normalizeForSearch(e.book.japaneseTitle).includes(normQ);
      const reading = e.book.titleReading;
      const readingMatch = reading ? normalizeForSearch(reading).includes(normQ) : false;
      const authorMatch = normalizeForSearch(e.book.author).includes(normQ);
      const romanMatch = normalizeForSearch(e.book.romanizedAuthor).includes(normQ);
      return titleMatch || jpTitleMatch || readingMatch || authorMatch || romanMatch;
    });
  }

  const authorCounts = new Map<string, number>();
  for (const entry of filtered) {
    const authorName = entry.book.author;
    if (authorName) authorCounts.set(authorName, (authorCounts.get(authorName) || 0) + 1);
  }
  const authors = Array.from(authorCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'))
    .slice(0, 20);

  const total = filtered.length;
  const pageSize = slugs ? 50 : PAGE_SIZE;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(pages, Math.max(1, page));
  const startIndex = (currentPage - 1) * pageSize;
  const books = filtered.slice(startIndex, startIndex + pageSize).map((e) => e.book);

  return {
    books,
    total,
    page: currentPage,
    pages,
    authors,
    categories,
  };
}
