// Run: node scripts/test-random-term.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const path = require('node:path');
const ts = require('typescript');

const filename = path.resolve(__dirname, '../src/lib/dictionary/randomTerm.ts');
const source = fs.readFileSync(filename, 'utf8');
const compiled = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 });
const loaded = new Module(filename, module);
loaded.filename = filename;
loaded.paths = Module._nodeModulePaths(path.dirname(filename));
loaded._compile(compiled, filename);
const { getSecondsUntilVietnamMidnight, getVietnamDayKey, selectDailyOffset } = loaded.exports;

assert.equal(getVietnamDayKey(new Date('2026-11-02T16:59:59.000Z')), '2026-11-02');
assert.equal(getVietnamDayKey(new Date('2026-11-02T17:00:00.000Z')), '2026-11-03');
assert.equal(getSecondsUntilVietnamMidnight(new Date('2026-11-02T16:59:00.000Z')), 60);
assert.equal(getSecondsUntilVietnamMidnight(new Date('2026-11-02T17:00:00.000Z')), 86_400);
assert.equal(selectDailyOffset('2026-11-03', 196_583), 123_906);
assert.equal(selectDailyOffset('2026-11-03', 196_583), selectDailyOffset('2026-11-03', 196_583));
assert.notEqual(selectDailyOffset('2026-11-03', 196_583), selectDailyOffset('2026-11-04', 196_583));
assert.equal(selectDailyOffset('2026-11-03', 0), null);
assert.equal(selectDailyOffset('2026-02-30', 196_583), null);
assert.equal(selectDailyOffset('invalid', 196_583), null);

console.log('Daily term selection checks passed.');
