// Run: node scripts/update-book-catalogue.cjs [path-to-official-zip]
// Refreshes the bundled metadata fallback only; never downloads or stores full texts.
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, imports) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, {
    exports, Buffer, TextDecoder, setTimeout, clearTimeout, AbortController, console,
    require(name) {
      if (name === 'server-only') return {};
      if (Object.hasOwn(imports, name)) return imports[name];
      if (name.startsWith('node:')) return require(name);
      throw new Error(`Unexpected import: ${name}`);
    },
  });
  return exports;
}

(async () => {
  const data = load('src/data/books.ts', {});
  const catalogue = load('src/lib/bookCatalogue.ts', {
    '@/data/books': data, '@/data/book-catalogue.json': [], 'next/server': { after() {} },
  });
  let zip;
  if (process.argv[2]) zip = fs.readFileSync(process.argv[2]);
  else {
    const response = await fetch('https://www.aozora.gr.jp/index_pages/list_person_all_extended_utf8.zip', {
      redirect: 'error', signal: AbortSignal.timeout(240000),
    });
    if (!response.ok) throw new Error(`Catalogue download failed: ${response.status}`);
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) throw new Error('Catalogue archive exceeds 8 MB');
      chunks.push(chunk);
    }
    zip = Buffer.concat(chunks);
  }
  const entries = catalogue.parseCatalogueEntries(catalogue.extractCatalogueCsv(zip));
  if (entries.length < 1000) throw new Error('Unexpectedly small catalogue; fallback not replaced');
  const destination = 'src/data/book-catalogue.json';
  fs.writeFileSync(`${destination}.tmp`, `${JSON.stringify(entries)}\n`);
  fs.renameSync(`${destination}.tmp`, destination);
  console.log(`Updated ${destination}: ${entries.length} works (metadata only).`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
