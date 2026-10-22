// Run: node scripts/check-books.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadModule(file, fetch, imports = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports, module: { exports }, fetch, Response, TextDecoder, AbortSignal, Buffer, Uint8Array,
    setTimeout, clearTimeout, console,
    require: (name) => {
      if (name === 'server-only') return {};
      if (name in imports) return imports[name];
      if (name === '@/lib/bookCatalogue') return { findCatalogueBook: async () => undefined };
      throw new Error(`Unexpected import: ${name}`);
    },
  }, { filename: file });
  return exports;
}

const fixture = (body) => `<?xml version="1.0" encoding="Shift_JIS"?><html><body><div class="metadata">Title</div><div class="main_text">${body}</div><div class="bibliographical_information">PRIVATE CREDITS</div><div class="after_text">PRIVATE FOOTER</div></body></html>`;
const response = (body) => new Response(body, { headers: { 'Content-Type': 'text/html; charset=Shift_JIS' } });
const flatten = (content) => content.paragraphs.flatMap((paragraph) => paragraph.segments.map((segment) => segment.text)).join('');

async function main() {
  const { books } = loadModule('src/data/books.ts');
  const calls = [];
  const provider = loadModule('src/lib/bookContent.ts', async (url, options) => {
    calls.push({ url, options });
    return response(fixture('<div><h4>Chapter</h4></div>\nFirst &amp; &#x65E5;.<br />\n<ruby><rb>Base</rb><rp>(</rp><rt>reading</rt><rp>)</rp></ruby> text.<br />\n<img src="remote.png" alt="25-12=" /><br />\n<script>alert(1)</script><style>evil</style><a href="javascript:alert(1)" onclick="evil()">Safe</a>'));
  });
  for (const book of books) {
    const content = await provider.getBookContent(book.slug);
    assert.ok(content?.paragraphs.length, book.slug);
    const value = JSON.parse(JSON.stringify(content));
    const text = flatten(value);
    assert.match(text, /First & 日/);
    assert.match(text, /25-12=/);
    assert.match(text, /Safe/);
    assert.doesNotMatch(text, /PRIVATE|alert|evil|remote\.png|<|>/);
    assert.ok(value.paragraphs.some((paragraph) => paragraph.kind === 'heading'));
    assert.ok(value.paragraphs.some((paragraph) => paragraph.segments.some((segment) => segment.text === 'Base' && segment.reading === 'reading')));
    assert.ok(!text.includes('reading'), 'Furigana must not be duplicated in the base text');
    assert.doesNotMatch(JSON.stringify(value), /aozora|青空文庫/i);
  }
  assert.equal(calls.length, books.length);
  for (const { url, options } of calls) {
    assert.match(url, /^https:\/\/www\.aozora\.gr\.jp\/cards\/\d{6}\/files\/\d+_\d+\.html$/);
    assert.equal(options.next.revalidate, 86400);
    assert.ok(options.signal, 'Upstream timeout required');
    assert.equal(options.redirect, 'error');
  }
  for (const slug of ['unknown', '__proto__', 'constructor', '../../etc/passwd', 'https://example.com']) {
    assert.equal(await provider.getBookContent(slug), null);
  }
  assert.equal(calls.length, books.length, 'Unknown slugs must never trigger an upstream fetch');

  const legacy = provider.parseBookHtml('<HTML><BODY><H1>Title</H1><H2>Author</H2><BR>Legacy text<BR>More text<HR>PRIVATE CREDITS</BODY></HTML>');
  assert.equal(flatten(legacy), 'Legacy textMore text');
  assert.throws(() => provider.parseBookHtml('<h1>Title</h1>Unbounded text'));

  // Decode actual Shift_JIS bytes rather than interpreting the response as UTF-8.
  const prefix = Buffer.from(fixture('PLACEHOLDER').split('PLACEHOLDER')[0]);
  const suffix = Buffer.from(fixture('PLACEHOLDER').split('PLACEHOLDER')[1]);
  const japanese = loadModule('src/lib/bookContent.ts', async () => response(Buffer.concat([prefix, Buffer.from([0x82, 0xa0]), suffix])));
  assert.equal(flatten(await japanese.getBookContent(books[0].slug)), 'あ');
  const splitBytes = [prefix, Buffer.from([0x82]), Buffer.from([0xa0]), suffix];
  const streamed = loadModule('src/lib/bookContent.ts', async () => new Response(new ReadableStream({
    start(controller) { splitBytes.forEach((bytes) => controller.enqueue(bytes)); controller.close(); },
  })));
  assert.equal(flatten(await streamed.getBookContent(books[0].slug)), 'あ', 'Split Shift_JIS bytes must survive streaming');
  const gaiji = provider.parseBookHtml(fixture('<img src="../../../gaiji/1-14/1-14-75.png" alt="gaiji" />'));
  assert.equal(flatten(gaiji), '勻');

  for (const makeResponse of [
    () => new Response('Unavailable', { status: 503 }),
    () => response('<html>Missing text container</html>'),
    () => response(fixture('')),
    () => response(fixture('x'.repeat(9 * 1024 * 1024))),
    () => response(Uint8Array.from([0x81])),
    () => new Response(fixture('text'), { headers: { 'Content-Length': String(9 * 1024 * 1024) } }),
  ]) {
    const failing = loadModule('src/lib/bookContent.ts', async () => makeResponse());
    await assert.rejects(() => failing.getBookContent(books[0].slug));
  }
  const offline = loadModule('src/lib/bookContent.ts', async () => { throw new Error('upstream secret URL'); });
  await assert.rejects(() => offline.getBookContent(books[0].slug));

  // Dynamic catalogue book fetch with UTF-8 encoding
  const dynamicCalls = [];
  const dynamicProvider = loadModule('src/lib/bookContent.ts', async (url, options) => {
    dynamicCalls.push({ url, options });
    return new Response(fixture('<div>UTF-8 dynamic content: 日本語テスト</div>'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }, {
    '@/lib/bookCatalogue': {
      findCatalogueBook: async (slug) => {
        if (slug === 'work-59898') {
          return {
            book: { slug: 'work-59898', title: 'Dynamic Work' },
            url: 'https://www.aozora.gr.jp/cards/001257/files/59898_70731.html',
            encoding: 'utf-8',
          };
        }
        return undefined;
      },
    },
  });

  const dynamicContent = await dynamicProvider.getBookContent('work-59898');
  assert.ok(dynamicContent?.paragraphs.length, 'Dynamic work must be parsed');
  assert.match(flatten(dynamicContent), /UTF-8 dynamic content: 日本語テスト/);
  assert.equal(dynamicCalls.length, 1);
  assert.equal(dynamicCalls[0].url, 'https://www.aozora.gr.jp/cards/001257/files/59898_70731.html');

  // Unknown dynamic work / arbitrary slugs must return null and never fetch arbitrary URLs
  assert.equal(await dynamicProvider.getBookContent('work-99999'), null);
  assert.equal(await dynamicProvider.getBookContent('work-invalid'), null);
  assert.equal(await dynamicProvider.getBookContent('work-0123'), null);
  assert.equal(await dynamicProvider.getBookContent('https://attacker.com/malicious.html'), null);
  assert.equal(dynamicCalls.length, 1, 'Unknown or non-catalogue slugs must never trigger upstream fetch');

  const routeFile = 'src/app/api/books/[slug]/content/route.ts';
  const routeImports = (getBookContent) => ({ '@/lib/bookContent': { getBookContent } });
  const request = new Request('http://localhost/api/books/test/content');
  const params = { params: Promise.resolve({ slug: books[0].slug }) };
  const goodRoute = loadModule(routeFile, undefined, routeImports(async () => ({ paragraphs: [{ kind: 'paragraph', segments: [{ text: 'ok' }] }] })));
  const success = await goodRoute.GET(request, params);
  assert.equal(success.status, 200);
  assert.match(success.headers.get('cache-control'), /max-age=3600/);
  const missingRoute = loadModule(routeFile, undefined, routeImports(async () => null));
  assert.equal((await missingRoute.GET(request, params)).status, 404);
  const badRoute = loadModule(routeFile, undefined, routeImports(async () => { throw new Error('upstream secret URL'); }));
  const unavailable = await badRoute.GET(request, params);
  assert.equal(unavailable.status, 503);
  assert.doesNotMatch(await unavailable.text(), /aozora|secret|https?:/i);
  assert.match(unavailable.headers.get('cache-control') || '', /no-store/);
  console.log(`PASS: ${books.length} sources, Shift_JIS, ruby, plain-data safety, unknown slugs, upstream errors, API statuses.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
