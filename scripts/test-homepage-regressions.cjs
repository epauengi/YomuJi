// Run: node scripts/test-homepage-regressions.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relPath) => fs.readFileSync(path.join(root, relPath), 'utf8');

// 1. RootShell must not mount or import global blocking offline prompt
const rootShell = read('src/components/RootShell.tsx');
assert(
  !rootShell.includes('OfflineDictionaryPrompt'),
  'RootShell must not import or render OfflineDictionaryPrompt'
);

// 2. Settings must still provide offline dictionary download
const settings = read('src/app/settings/page.tsx');
assert(
  settings.includes('downloadOfflineDictionary'),
  'Settings must import/call downloadOfflineDictionary'
);
assert(
  /tải dữ liệu offline/i.test(settings),
  'Settings UI must retain offline download action'
);

// 3. Headings hierarchy and semantic tags across homepage & reader
const homePage = read('src/components/HomePage.tsx');
const reader = read('src/components/dictionary/InteractiveJapaneseReader.tsx');

assert(
  /<h1\b/i.test(homePage),
  'HomePage must provide a primary h1 heading'
);
assert(
  /<h2\b[^>]*>[^<]*<Sparkle\b[^>]*\/>\s*Từ vựng hôm nay\s*<\/h2>/i.test(homePage),
  'Word-of-the-day section label must be an h2'
);
assert(/<motion\.h3\b/i.test(homePage), 'Word of the day must remain an h3');
assert(
  /<h2\b[^>]*>[\s\S]*?Bài đọc ngẫu nhiên[\s\S]*?<\/h2>/i.test(reader) && /<h3\b/i.test(reader),
  'Random article section and article title must use h2 and h3'
);

// 4. Random article reader badge/label must not be labeled as today-only
assert(
  !reader.includes('Bài đọc hôm nay'),
  'Reader badge must not use misleading "Bài đọc hôm nay" label for random articles'
);
assert(
  /ngẫu nhiên|random/i.test(reader),
  'Reader must indicate random article source in badge/label'
);
assert(
  /aria-label="Đọc bài khác[^\"]*ngẫu nhiên/i.test(reader),
  'Refresh button accessible name must include its visible label and indicate randomness'
);

// 5. Minimum 44px touch target on interactive links
const minHitPattern = /\b(min-h-11|min-h-\[44px\]|h-11|h-\[44px\])\b/;

// 5a. Wikipedia external link in reader
const wikiLinkMatch = reader.match(/<a\b[^>]*href=\{url\}[^>]*>/) || reader.match(/<a\b[^>]*wikipedia[^>]*>/i);
assert(
  wikiLinkMatch && minHitPattern.test(wikiLinkMatch[0]),
  'Reader Wikipedia link must provide at least 44px hit size (e.g. min-h-11)'
);

// 5b. Word of the day detail link in HomePage
const wordDetailLinkMatch = homePage.match(/<Link\b[^>]*href=\{wordHref\(wordOfTheDay\)\}[^>]*>/)
  || homePage.match(/<Link\b[^>]*>[\s\S]*?Xem chi tiết/i);
assert(
  wordDetailLinkMatch && minHitPattern.test(wordDetailLinkMatch[0]),
  'HomePage word-of-the-day detail link must provide at least 44px hit size (e.g. min-h-11)'
);

// 6. Hero decorative motion removed from HomePage
assert(
  !homePage.includes('handleMouseMove') && !homePage.includes('mousePos'),
  'Hero mouse parallax motion handlers must be removed from HomePage'
);
assert(
  !/\banimate-orb-\d\b/.test(homePage) && !/\banimate-kanji-(slow|rev)\b/.test(homePage),
  'Hero decorative orb and kanji floating animations must be removed from HomePage'
);

console.log('PASS homepage regressions: offline prompt removed, settings download preserved, headings semantic, 44px links, random reader label, hero motion removed');
