// Run: node scripts/check-theme-bootstrap.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../src/app/layout.tsx'), 'utf8');
const bootstrap = source.match(/<head>[\s\S]*?<script dangerouslySetInnerHTML=\{\{ __html: `([^`]+)` \}\}/)?.[1];
assert.ok(bootstrap, 'theme script must run in <head>');
for (const [preference, systemDark, expected] of [
  ['dark', false, 'dark'], ['light', true, 'light'], ['system', true, 'dark'],
  [null, false, 'light'], ['invalid', true, 'dark'], ['blocked', true, 'dark'],
]) {
  const dataset = {};
  vm.runInNewContext(bootstrap, {
    document: { documentElement: { dataset } },
    localStorage: { getItem: (key) => {
      assert.equal(key, 'yomuji_theme');
      if (preference === 'blocked') throw new Error('Storage unavailable');
      return preference;
    } },
    matchMedia: (query) => {
      assert.equal(query, '(prefers-color-scheme: dark)');
      return { matches: systemDark };
    },
  });
  assert.equal(dataset.theme, expected, `preference=${preference}, systemDark=${systemDark}`);
}
console.log('PASS initial theme: saved choice, system, invalid and blocked storage');
