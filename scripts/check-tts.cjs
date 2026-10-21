// Run: node scripts/check-tts.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const code = ts.transpileModule(fs.readFileSync('src/lib/tts.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const tracker = (onErr) => {
  const events = [];
  return { events, onStart: () => events.push('start'), onEnd: () => events.push('end'), onError: (e) => { events.push('error'); onErr?.(e); } };
};

function createEnv(opts = {}) {
  let lastAudio = null, lastUtt = null, speakCount = 0;
  class MockAudio {
    constructor(src) {
      this.src = src; this.currentTime = 0; this.paused = true;
      this.playDef = deferred(); lastAudio = this;
    }
    play() { this.paused = false; return this.playDef.promise; }
    pause() { this.paused = true; }
  }
  class MockUtterance {
    constructor(text) {
      if (opts.throwConstruct) throw new Error('construct failed');
      this.text = text; this.lang = ''; lastUtt = this;
    }
  }
  const synth = opts.noSpeech ? undefined : {
    cancel() {},
    getVoices() { return [{ lang: 'ja-JP' }]; },
    speak(u) {
      if (opts.throwSpeak) throw new Error('speak failed');
      speakCount++; lastUtt = u;
    },
  };
  const window = opts.noWindow ? undefined : {
    ...(opts.noSpeech ? {} : { speechSynthesis: synth }),
  };
  if (window) window.window = window;

  const sandbox = {
    exports: {}, module: {}, Audio: MockAudio, SpeechSynthesisUtterance: MockUtterance,
    window, DOMException: globalThis.DOMException || Error, Error, encodeURIComponent,
  };
  sandbox.module.exports = sandbox.exports;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);

  return {
    ...sandbox.exports,
    get lastAudio() { return lastAudio; },
    get lastUtt() { return lastUtt; },
    get speakCount() { return speakCount; },
  };
}

async function main() {
  // 1. Primary success URL with custom voice/rate and defaults
  {
    const env = createEnv(), cb = tracker();
    const p = env.playJapaneseAudio('こんにちは', { voice: 'v', rate: '20%', ...cb });
    const a = env.lastAudio, { onplay, onended } = a;
    assert.equal(a.src, '/api/tts?text=%E3%81%93%E3%82%93%E3%81%AB%E3%81%A1%E3%81%AF&voice=v&rate=20%25');
    a.playDef.resolve(); await p;
    onplay(); onended();
    assert.deepEqual(cb.events, ['start', 'end']);

    const defCb = tracker(), pDef = env.playJapaneseAudio('テスト', defCb);
    assert.equal(env.lastAudio.src, '/api/tts?text=%E3%83%86%E3%82%B9%E3%83%88&voice=ja-JP-NanamiNeural&rate=0%25');
    env.lastAudio.playDef.resolve(); await pDef; env.lastAudio.onended();
    assert.deepEqual(defCb.events, ['end']);
  }

  // 2. Blank / whitespace text is no-op
  {
    const env = createEnv(), cb = tracker();
    await env.playJapaneseAudio('', cb);
    await env.playJapaneseAudio('   \n\t  ', cb);
    assert.equal(env.lastAudio, null);
    assert.equal(env.speakCount, 0);
    assert.deepEqual(cb.events, []);
  }

  // 3. Dual failure both orders starts fallback once; captured onerror cannot duplicate
  for (const first of ['reject', 'error']) {
    const env = createEnv(), cb = tracker(), p = env.playJapaneseAudio('fail', cb);
    const a = env.lastAudio, { onerror: err } = a;
    if (first === 'reject') {
      a.playDef.reject(new Error('play fail')); await p; await flush(); err();
    } else {
      err(); await flush(); a.playDef.reject(new Error('play fail')); await p;
    }
    await flush();
    assert.equal(env.speakCount, 1, `dual failure via ${first} must start fallback only once`);
  }

  // 4. Fallback success one utterance; captured primary callbacks don't finish/restart
  {
    const env = createEnv(), cb = tracker(), p = env.playJapaneseAudio('fallback-ok', cb);
    const a = env.lastAudio, { onplay, onended, onerror } = a;
    a.playDef.reject(new Error('primary fail')); await p; await flush();
    assert.equal(env.speakCount, 1);
    const u = env.lastUtt;
    assert.equal(u.text, 'fallback-ok'); assert.equal(u.lang, 'ja-JP');

    onplay(); onerror(new Error('stale')); onended();
    await flush();
    assert.deepEqual(cb.events, []);
    assert.equal(env.speakCount, 1);

    u.onstart(); u.onend();
    assert.deepEqual(cb.events, ['start', 'end']);
  }

  // 5. Genuine fallback failure sends error+end once; later utterance callbacks suppressed
  {
    const env = createEnv(), cb = tracker(), p = env.playJapaneseAudio('fb-err', cb);
    env.lastAudio.playDef.reject(new Error('f')); await p; await flush();
    const u = env.lastUtt, { onend, onerror } = u;
    onerror({ error: 'synth fail' }); await flush();
    assert.deepEqual(cb.events, ['error', 'end']);

    onend(); onerror({ error: 'repeat fail' }); await flush();
    assert.deepEqual(cb.events, ['error', 'end']);
  }

  // 6. onError starting replacement must NOT invoke previous onEnd
  {
    const env = createEnv(), cb2 = tracker();
    const cb1 = tracker(() => { env.playJapaneseAudio('replacement', cb2); });
    const p1 = env.playJapaneseAudio('fail-then-replace', cb1);
    env.lastAudio.playDef.reject(new Error('primary fail')); await p1; await flush();
    env.lastUtt.onerror({ error: 'synth error' }); await flush();
    assert.deepEqual(cb1.events, ['error'], 'replacement inside onError suppresses previous onEnd');
    env.lastAudio.playDef.resolve(); env.lastAudio.onended();
    assert.deepEqual(cb2.events, ['end']);
  }

  // 7. Stop pending with AbortError and generic error suppresses fallback & callbacks
  for (const err of [new DOMException('abort', 'AbortError'), new Error('500')]) {
    const env = createEnv(), cb = tracker(), p = env.playJapaneseAudio('stop', cb);
    const a = env.lastAudio, h = { onplay: a.onplay, onended: a.onended, onerror: a.onerror };
    env.stopCurrentAudio();
    a.playDef.reject(err); await p; await flush();
    h.onplay(); h.onended(); h.onerror();
    assert.equal(env.speakCount, 0);
    assert.deepEqual(cb.events, []);
  }

  // 8. Replacement while pending suppresses old callbacks/fallback; only current plays
  {
    const env = createEnv(), cb1 = tracker(), cb2 = tracker();
    const p1 = env.playJapaneseAudio('req1', cb1), a1 = env.lastAudio;
    const h1 = { onplay: a1.onplay, onended: a1.onended, onerror: a1.onerror };
    const p2 = env.playJapaneseAudio('req2', cb2), a2 = env.lastAudio;
    a1.playDef.reject(new Error('req1 aborted')); await p1;
    h1.onplay(); h1.onended(); h1.onerror(); await flush();
    assert.equal(env.speakCount, 0); assert.deepEqual(cb1.events, []);

    a2.playDef.resolve(); await p2; a2.onplay(); a2.onended();
    assert.deepEqual(cb2.events, ['start', 'end']); assert.deepEqual(cb1.events, []);
  }

  // 9. Stop and replacement during fallback suppresses stale utterance callbacks
  for (const mode of ['stop', 'replace']) {
    const env = createEnv(), cb1 = tracker(), cb2 = tracker();
    const p1 = env.playJapaneseAudio('fb-stale', cb1);
    env.lastAudio.playDef.reject(new Error('f')); await p1; await flush();
    const { onstart, onend, onerror } = env.lastUtt;
    let p2;
    if (mode === 'stop') env.stopCurrentAudio();
    else p2 = env.playJapaneseAudio('r2', cb2);
    onstart(); onerror({ error: 'canceled' }); onend();
    await flush();
    assert.deepEqual(cb1.events, []);
    if (p2) {
      env.lastAudio.playDef.resolve(); await p2; env.lastAudio.onended();
      assert.deepEqual(cb2.events, ['end']);
    }
  }

  // 10. Missing speech, constructor throw, speak throw send error+end once
  for (const opt of [{ noSpeech: true }, { throwConstruct: true }, { throwSpeak: true }]) {
    const env = createEnv(opt), cb = tracker(), p = env.playJapaneseAudio('throw', cb);
    env.lastAudio.playDef.reject(new Error('f')); await p; await flush();
    assert.deepEqual(cb.events, ['error', 'end']);
  }

  // 11. Successful onEnd callback starts another request without cancellation
  {
    const env = createEnv(), cb2 = tracker();
    const p1 = env.playJapaneseAudio('first', {
      onEnd: () => { env.playJapaneseAudio('second', cb2); },
    });
    const a1 = env.lastAudio;
    a1.playDef.resolve(); await p1; a1.onended(); await flush();

    const a2 = env.lastAudio;
    assert.notEqual(a1, a2); assert.equal(a2.paused, false);
    a2.playDef.resolve(); a2.onended();
    assert.deepEqual(cb2.events, ['end']);
  }

  // 12. AbortError without stopCurrentAudio does not start fallback and calls onEnd once
  {
    const env = createEnv(), cb = tracker(), p = env.playJapaneseAudio('abort-no-stop', cb);
    env.lastAudio.playDef.reject(new DOMException('interrupted', 'AbortError'));
    await p; await flush();
    assert.equal(env.speakCount, 0);
    assert.deepEqual(cb.events, ['end']);
  }

  console.log('PASS tts primary, fallback, stop/replacement guards, queued callbacks, chaining');
}

main();
