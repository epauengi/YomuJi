import 'server-only';
import { findCatalogueBook } from '@/lib/bookCatalogue';

export type BookSegment = {
  text: string;
  reading?: string;
};

export type BookParagraph = {
  kind: 'paragraph' | 'heading';
  segments: BookSegment[];
};

export type BookContent = {
  paragraphs: BookParagraph[];
};

const AOZORA_BASE_URL = 'https://www.aozora.gr.jp/cards/';
const MAX_SOURCE_BYTES = 8 * 1024 * 1024; // Bound long novels without accepting unbounded upstream bodies.

const BOOK_SOURCES: Readonly<Record<string, string>> = {
  'kyonen-no-ki': '000121/files/4719_13221.html',
  'nihiki-no-kaeru': '000121/files/4718_13223.html',
  'amedama': '000121/files/4723_13209.html',
  'gon-gitsune': '000121/files/628_14895.html',
  'tebukuro-o-kai-ni': '000121/files/637_13341.html',
  'chumon-no-ooi-ryoriten': '000081/files/43754_17659.html',
  'majutsu': '000879/files/95_15247.html',
  'momotaro': '000329/files/18376_12100.html',
  'hashire-merosu': '000035/files/1567_14913.html',
  'torokko': '000879/files/43016_16836.html',
  'hana': '000879/files/42_15228.html',
  'aguni-no-kami': '000879/files/43014_17430.html',
  'kaze-no-matasaburo': '000081/files/462_15405.html',
};

function decodeEntities(str: string): string {
  return str.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(amp|lt|gt|quot|apos|nbsp));/g, (_, dec, hex, named) => {
    if (dec || hex) {
      const point = parseInt(dec || hex, dec ? 10 : 16);
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff) ? String.fromCodePoint(point) : '\uFFFD';
    }
    switch (named) {
      case 'amp': return '&';
      case 'lt': return '<';
      case 'gt': return '>';
      case 'quot': return '"';
      case 'apos': return "'";
      case 'nbsp': return '\u00A0';
      default: return _;
    }
  });
}

function parseSegments(rawHtml: string): BookSegment[] {
  const segments: BookSegment[] = [];
  const rubyRegex = /<ruby\b[^>]*>([\s\S]*?)<\/ruby>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = rubyRegex.exec(rawHtml)) !== null) {
    const textBefore = rawHtml.slice(lastIndex, match.index);
    if (textBefore) {
      const cleanText = decodeEntities(textBefore.replace(/<[^>]+>/g, ''));
      if (cleanText) {
        pushTextSegment(segments, cleanText);
      }
    }

    const rubyContent = match[1];
    const rtMatch = rubyContent.match(/<rt\b[^>]*>([\s\S]*?)<\/rt>/i);
    const rbMatch = rubyContent.match(/<rb\b[^>]*>([\s\S]*?)<\/rb>/i);

    let baseText = '';
    if (rbMatch) {
      baseText = rbMatch[1].replace(/<[^>]+>/g, '');
    } else {
      baseText = rubyContent
        .replace(/<rt\b[\s\S]*?<\/rt>/gi, '')
        .replace(/<rp\b[\s\S]*?<\/rp>/gi, '')
        .replace(/<[^>]+>/g, '');
    }

    const cleanBase = decodeEntities(baseText);
    const cleanReading = rtMatch
      ? decodeEntities(rtMatch[1].replace(/<[^>]+>/g, '').trim())
      : undefined;

    if (cleanBase) {
      segments.push(cleanReading ? { text: cleanBase, reading: cleanReading } : { text: cleanBase });
    }

    lastIndex = rubyRegex.lastIndex;
  }

  const textAfter = rawHtml.slice(lastIndex);
  if (textAfter) {
    const cleanText = decodeEntities(textAfter.replace(/<[^>]+>/g, ''));
    if (cleanText) {
      pushTextSegment(segments, cleanText);
    }
  }

  return segments;
}

function pushTextSegment(segments: BookSegment[], text: string) {
  const last = segments[segments.length - 1];
  if (last && !last.reading) {
    last.text += text;
  } else {
    segments.push({ text });
  }
}

// ponytail: supports standard XHTML and legacy author-heading/HR boundaries; use a DOM parser for nested ruby or other layouts.
export function parseBookHtml(html: string): BookContent {
  const main = /<div\b[^>]*\bclass=["']main_text["'][^>]*>/i.exec(html);
  const biblio = /<div\b[^>]*\bclass=["']bibliographical_information["'][^>]*>/i.exec(html);
  let textChunk: string;
  if (main && biblio && biblio.index > main.index) {
    textChunk = html.slice(main.index + main[0].length, biblio.index);
  } else if (!main) {
    const author = /<h2\b[^>]*>[\s\S]*?<\/h2\s*>/i.exec(html);
    const end = /<hr\b[^>]*>/i.exec(html);
    if (!/<h1\b/i.test(html) || !author || !end || end.index <= author.index) throw new Error('Unsupported book HTML structure');
    textChunk = html.slice(author.index + author[0].length, end.index);
  } else {
    throw new Error('Unsupported book XHTML structure');
  }

  textChunk = textChunk
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style>/gi, '')
    .replace(/<rp\b[^>]*>[\s\S]*?<\/rp>/gi, '');

  textChunk = textChunk.replace(/<img\b([^>]*)>/gi, (_, attrs) => {
    if (/1-14-75/i.test(attrs)) {
      return '勻';
    }
    const altMatch = attrs.match(/\balt=(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const alt = altMatch ? (altMatch[1] ?? altMatch[2] ?? altMatch[3] ?? '') : '';
    return alt;
  });

  textChunk = textChunk.replace(/<h[34]\b[^>]*>([\s\S]*?)<\/h[34]>/gi, '\n\u0001$1\u0002\n');
  textChunk = textChunk.replace(/<\/div\s*>/gi, '\n');
  textChunk = textChunk.replace(/<div\b[^>]*>/gi, '\n');
  textChunk = textChunk.replace(/<br\s*\/?>/gi, '\n');

  const rawLines = textChunk.split(/\r?\n/);
  const paragraphs: BookParagraph[] = [];

  for (const rawLine of rawLines) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    const headingMatch = trimmed.match(/^\u0001([\s\S]*?)\u0002$/);
    if (headingMatch) {
      const segments = parseSegments(headingMatch[1]);
      if (segments.length > 0 && segments.some((s) => s.text.trim())) {
        paragraphs.push({ kind: 'heading', segments });
      }
      continue;
    }

    const segments = parseSegments(rawLine);
    if (segments.length > 0 && segments.some((s) => s.text.trim())) {
      paragraphs.push({ kind: 'paragraph', segments });
    }
  }

  if (paragraphs.length === 0) {
    throw new Error('Parsed book body is empty');
  }

  return { paragraphs };
}

export async function getBookContent(slug: string): Promise<BookContent | null> {
  const sourceRelative = Object.hasOwn(BOOK_SOURCES, slug) ? BOOK_SOURCES[slug] : undefined;
  if (!sourceRelative && !/^work-[1-9]\d{0,5}$/.test(slug)) return null;
  const entry = sourceRelative ? undefined : await findCatalogueBook(slug);
  if (!sourceRelative && !entry) return null;
  const upstreamUrl = sourceRelative ? `${AOZORA_BASE_URL}${sourceRelative}` : entry!.url;
  const encoding = entry?.encoding || 'shift_jis';

  const response = await fetch(upstreamUrl, {
    redirect: 'error',
    signal: AbortSignal.timeout(90000),
    next: { revalidate: 86400 },
  });

  if (!response.ok) {
    throw new Error(`Upstream fetch failed: ${response.status}`);
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_SOURCE_BYTES) {
    throw new Error('Upstream payload exceeds size limit');
  }

  if (!response.body) throw new Error('Empty upstream response');
  const reader = response.body.getReader();
  const decoder = new TextDecoder(encoding, { fatal: true });
  let size = 0;
  let html = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_SOURCE_BYTES) throw new Error('Upstream buffer exceeds size limit');
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  return parseBookHtml(html);
}
