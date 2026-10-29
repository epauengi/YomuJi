// Run: node scripts/check-kanji-ai.cjs. Stubbed provider; never sends paid requests.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync('src/app/api/ai/explain-kanji/route.ts', 'utf8');
assert(!/tokenrouter/i.test(source));
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const explanation = { vietnameseMeaning: 'Meaning', etymology: 'Origin', mnemonic: 'Memory', nuance: '', compounds: [] };
const calls = [];
const env = { GEMINI_API_KEY: 'test-only' };
let unavailable = false;
const sandbox = {
  exports: {}, process: { env }, AbortSignal,
  console: { warn() {}, error() {} },
  require(name) {
    assert.equal(name, 'next/server');
    return { NextResponse: { json(body, options) { return { body, status: options?.status || 200 }; } } };
  },
  async fetch(url) {
    calls.push(url);
    assert(url.startsWith('https://generativelanguage.googleapis.com/'));
    return { ok: !unavailable, status: unavailable ? 503 : 200, async json() {
      return { candidates: [{ content: { parts: [{ text: JSON.stringify(explanation) }] } }] };
    } };
  },
};
vm.runInNewContext(code, sandbox);
const request = (body) => ({ async json() { return body; } });
const input = { literal: '\u98df', hanViet: [], meanings: [], components: [], onReadings: [], kunReadings: [] };
(async () => {
  assert.equal((await sandbox.exports.POST(request({ literal: 'bad' }))).status, 400);
  assert.equal(calls.length, 0);
  const success = await sandbox.exports.POST(request(input));
  assert.equal(success.status, 200);
  assert.equal(success.body.explanation.vietnameseMeaning, explanation.vietnameseMeaning);
  assert.equal(calls.length, 1);
  unavailable = true;
  calls.length = 0;
  assert.equal((await sandbox.exports.POST(request(input))).status, 503);
  assert.equal(calls.length, 3);
  delete env.GEMINI_API_KEY;
  calls.length = 0;
  assert.equal((await sandbox.exports.POST(request(input))).status, 503);
  assert.equal(calls.length, 0);
  console.log('PASS: Gemini-only success, invalid input, provider failures, missing key.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
