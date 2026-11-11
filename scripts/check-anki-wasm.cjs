// Run: node scripts/check-anki-wasm.cjs
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
assert.deepEqual(readFileSync('public/anki/sql-wasm.wasm'), readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm')), 'Refresh public/anki/sql-wasm.wasm after upgrading sql.js');
assert.deepEqual(readFileSync('public/anki/LICENSE-sql.js.txt'), readFileSync('node_modules/sql.js/LICENSE'));
console.log('PASS bundled SQLite WASM and license match installed sql.js');
