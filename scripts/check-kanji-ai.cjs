// Run: node scripts/check-kanji-ai.cjs. Stubbed providers; never sends paid requests.
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
const env = { NVIDIA_API_KEY: 'test-nvidia', GEMINI_API_KEY: 'test-gemini' };
let nvidiaMode = 'success';
let geminiUnavailable = false;
const sandbox = {
  exports: {}, process: { env }, AbortSignal,
  console: { warn() {}, error() {} },
  require(name) {
    assert.equal(name, 'next/server');
    return { NextResponse: { json(body, options) { return { body, status: options?.status || 200 }; } } };
  },
  async fetch(url, options) {
    calls.push(url);
    const body = JSON.parse(options.body);
    assert.equal(options.method, 'POST');
    assert(options.signal instanceof AbortSignal);
    if (url === 'https://integrate.api.nvidia.com/v1/chat/completions') {
      assert.equal(options.headers.Authorization, 'Bearer test-nvidia');
      assert.equal(options.redirect, 'error');
      assert.equal(body.model, 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning');
      assert.equal(body.stream, false);
      assert.equal(body.max_tokens, 1200);
      assert.equal(body.messages[0].role, 'user');
      if (nvidiaMode === 'timeout') throw Object.assign(new Error('timed out'), { name: 'TimeoutError' });
      return { ok: nvidiaMode !== 'http', status: nvidiaMode === 'http' ? 429 : 200, async json() {
        if (nvidiaMode === 'json') throw new SyntaxError('invalid JSON');
        const content = nvidiaMode === 'schema' ? '{}' : JSON.stringify(explanation);
        return nvidiaMode === 'missing' ? {} : { choices: [{ message: { content } }] };
      } };
    }
    assert(url.startsWith('https://generativelanguage.googleapis.com/'));
    assert.equal(options.headers['x-goog-api-key'], 'test-gemini');
    return { ok: !geminiUnavailable, status: geminiUnavailable ? 503 : 200, async json() {
      return { candidates: [{ content: { parts: [{ text: JSON.stringify(explanation) }] } }] };
    } };
  },
};
vm.runInNewContext(code, sandbox);
const request = (body) => ({ async json() { return body; } });
const input = { literal: '\u98df', hanViet: [], meanings: [], components: [], onReadings: [], kunReadings: [] };
const run = () => sandbox.exports.POST(request(input));
(async () => {
  assert.equal((await sandbox.exports.POST(request({ literal: 'bad' }))).status, 400);
  assert.equal(calls.length, 0);
  const success = await run();
  assert.equal(success.status, 200);
  assert.equal(success.body.explanation.vietnameseMeaning, explanation.vietnameseMeaning);
  assert.equal(calls.length, 1, 'NVIDIA success must not call Gemini');
  for (const failure of ['http', 'json', 'schema', 'missing', 'timeout']) {
    calls.length = 0;
    nvidiaMode = failure;
    assert.equal((await run()).status, 200);
    assert.equal(calls.length, 2, `${failure} must fall back to Gemini`);
  }
  delete env.NVIDIA_API_KEY;
  calls.length = 0;
  assert.equal((await run()).status, 200);
  assert.equal(calls.length, 1, 'Missing NVIDIA key skips its request');
  env.NVIDIA_API_KEY = 'test-nvidia';
  delete env.GEMINI_API_KEY;
  nvidiaMode = 'success';
  calls.length = 0;
  assert.equal((await run()).status, 200, 'NVIDIA-only configuration works');
  assert.equal(calls.length, 1);
  env.GEMINI_API_KEY = 'test-gemini';
  nvidiaMode = 'http';
  geminiUnavailable = true;
  calls.length = 0;
  assert.equal((await run()).status, 503);
  assert.equal(calls.length, 4, 'NVIDIA failure retains three Gemini attempts');
  delete env.NVIDIA_API_KEY;
  delete env.GEMINI_API_KEY;
  calls.length = 0;
  assert.equal((await run()).status, 503);
  assert.equal(calls.length, 0);
  console.log('PASS: NVIDIA primary, Gemini fallback, validation, malformed responses, timeout, missing keys.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
