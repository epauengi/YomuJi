import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFurigana } from './furigana';
import { matchSentenceGrammar } from './matcher';
import type { Phrase } from '@/lib/sentenceParse';
import type { GrammarPoint } from '@/types/grammar';

const sampleGrammar: GrammarPoint[] = [
  {
    id: 'te-mo-ii',
    slug: 'te-mo-ii',
    pattern: '〜てもいい',
    reading: '〜てもいい',
    romaji: 'te mo ii',
    level: 'N5',
    meaningVi: 'có thể ~, được phép ~',
    meaningEn: 'may; it is okay to',
    formation: 'Vて + もいい',
    nuanceVi: 'Dùng để xin phép hoặc cho phép.',
    tags: ['permission'],
    examples: [],
    matchPatterns: ['てもいい'],
    order: 1,
  },
  {
    id: 'nakereba-naranai',
    slug: 'nakereba-naranai',
    pattern: '〜なければならない',
    reading: '〜なければならない',
    romaji: 'nakereba naranai',
    level: 'N5',
    meaningVi: 'phải ~',
    meaningEn: 'must; have to',
    formation: 'V-nai (bỏ ない) + なければならない',
    nuanceVi: 'Diễn tả nghĩa vụ.',
    tags: ['obligation'],
    examples: [],
    matchPatterns: ['なければならない'],
    order: 2,
  },
  {
    id: 'te-iru',
    slug: 'te-iru',
    pattern: '〜ている',
    reading: '〜ている',
    romaji: 'te iru',
    level: 'N5',
    meaningVi: 'đang ~ / trạng thái đã ~',
    meaningEn: 'be doing',
    formation: 'Vて + いる',
    nuanceVi: 'Hành động tiếp diễn hoặc trạng thái kết quả.',
    tags: ['aspect'],
    examples: [],
    matchPatterns: ['ている'],
    order: 3,
  },
  {
    id: 'no-hou-ga-yori',
    slug: 'no-hou-ga-yori',
    pattern: '〜の方が〜より',
    reading: '〜のほうが〜より',
    romaji: 'no hou ga ... yori',
    level: 'N5',
    meaningVi: 'A hơn B',
    meaningEn: 'X is more ... than Y',
    formation: 'N + の方が + N + より',
    nuanceVi: 'So sánh hai đối tượng.',
    tags: ['comparison'],
    examples: [],
    matchPatterns: ['の方が〜より', 'のほうが〜より'],
    order: 4,
  },
  {
    id: 'kara-from',
    slug: 'kara-from',
    pattern: '〜から（from）',
    reading: '〜から',
    romaji: 'kara',
    level: 'N5',
    meaningVi: 'từ ~',
    meaningEn: 'from',
    formation: 'N + から',
    nuanceVi: 'Điểm khởi đầu.',
    tags: ['particle'],
    examples: [],
    matchPatterns: ['から'],
    order: 5,
  },
  {
    id: 'mo',
    slug: 'mo',
    pattern: '〜も',
    reading: '〜も',
    romaji: 'mo',
    level: 'N5',
    meaningVi: 'cũng ~',
    meaningEn: 'also',
    formation: 'N + も',
    nuanceVi: 'Trợ từ bổ sung.',
    tags: ['particle'],
    examples: [],
    matchPatterns: ['も'],
    order: 6,
  },
];

test('parseFurigana splits ruby pairs and plain text cleanly', () => {
  assert.deepEqual(parseFurigana('{私|わたし}は{学生|がくせい}です。'), [
    { text: '私', reading: 'わたし' },
    { text: 'は' },
    { text: '学生', reading: 'がくせい' },
    { text: 'です。' },
  ]);
});

test('matchSentenceGrammar catches polite inflections and suppresses contained 1-char particles', () => {
  const sentences: Phrase[][] = [
    [
      {
        text: '早く',
        reading: 'はやく',
        role: 'adverbial',
        note: 'Trạng ngữ',
        tokens: [{ surface: '早く', base: '早い', reading: 'はやく', pos: '形容詞', lookup: true }],
      },
      {
        text: '起きなければなりません',
        reading: 'おきなければなりません',
        role: 'predicate',
        note: 'Vị ngữ',
        tokens: [
          { surface: '起き', base: '起きる', reading: 'おき', pos: '動詞', lookup: true },
          { surface: 'なけれ', base: 'ない', reading: 'なけれ', pos: '助動詞', lookup: false },
          { surface: 'ば', base: 'ば', reading: 'ば', pos: '助詞', lookup: true },
          { surface: 'なり', base: 'なる', reading: 'なり', pos: '動詞', lookup: false },
          { surface: 'ませ', base: 'ます', reading: 'ませ', pos: '助動詞', lookup: false },
          { surface: 'ん', base: 'ん', reading: 'ん', pos: '助動詞', lookup: false },
        ],
      },
    ],
  ];

  const matches = matchSentenceGrammar(sentences, sampleGrammar);
  assert.deepEqual(
    matches.map((m) => ({ id: m.grammar.id, matchedText: m.matchedText, phrases: m.phraseIndices })),
    [{ id: 'nakereba-naranai', matchedText: 'なければなりません', phrases: [1] }]
  );
});

test('matchSentenceGrammar catches voiced te-form variants and discontinuous patterns', () => {
  const sentences: Phrase[][] = [
    [
      {
        text: '犬の方が',
        reading: 'いぬのほうが',
        role: 'subject',
        note: 'Chủ ngữ',
        tokens: [
          { surface: '犬', base: '犬', reading: 'いぬ', pos: '名詞', lookup: true },
          { surface: 'の', base: 'の', reading: 'の', pos: '助詞', lookup: true },
          { surface: '方', base: '方', reading: 'ほう', pos: '名詞', lookup: true },
          { surface: 'が', base: 'が', reading: 'が', pos: '助詞', lookup: true },
        ],
      },
      {
        text: '猫より',
        reading: 'ねこより',
        role: 'complement',
        note: 'So sánh',
        tokens: [
          { surface: '猫', base: '猫', reading: 'ねこ', pos: '名詞', lookup: true },
          { surface: 'より', base: 'より', reading: 'より', pos: '助詞', lookup: true },
        ],
      },
      {
        text: '泳いでいます',
        reading: 'およいでいます',
        role: 'predicate',
        note: 'Vị ngữ',
        tokens: [
          { surface: '泳い', base: '泳ぐ', reading: 'およい', pos: '動詞', lookup: true },
          { surface: 'で', base: 'て', reading: 'で', pos: '助詞', lookup: true },
          { surface: 'い', base: 'いる', reading: 'い', pos: '動詞', lookup: false },
          { surface: 'ます', base: 'ます', reading: 'ます', pos: '助動詞', lookup: false },
        ],
      },
    ],
  ];

  const matches = matchSentenceGrammar(sentences, sampleGrammar);
  assert.deepEqual(
    matches.map((m) => ({ id: m.grammar.id, phrases: m.phraseIndices })),
    [
      { id: 'no-hou-ga-yori', phrases: [0, 1] },
      { id: 'te-iru', phrases: [2] },
    ]
  );
});

test('matchSentenceGrammar avoids false positives inside content nouns and verb stems', () => {
  const withNari: GrammarPoint[] = [
    ...sampleGrammar,
    {
      id: 'nari',
      slug: 'nari',
      pattern: '〜なり',
      reading: '〜なり',
      romaji: 'nari',
      level: 'N1',
      meaningVi: 'ngay khi ~',
      meaningEn: 'as soon as',
      formation: 'Vる + なり',
      nuanceVi: 'Hành động tiếp theo diễn ra ngay lập tức.',
      tags: ['time'],
      examples: [],
      matchPatterns: ['なり'],
      order: 7,
    },
  ];
  const sentences: Phrase[][] = [
    [
      {
        text: 'からだ',
        reading: 'からだ',
        role: 'other',
        note: 'Danh từ',
        tokens: [{ surface: 'からだ', base: 'からだ', reading: 'からだ', pos: '名詞', lookup: true }],
      },
      {
        text: '面白くなります',
        reading: 'おもしろくなります',
        role: 'predicate',
        note: 'Vị ngữ',
        tokens: [
          { surface: '面白く', base: '面白い', reading: 'おもしろく', pos: '形容詞', lookup: true },
          { surface: 'なり', base: 'なる', reading: 'なり', pos: '動詞', lookup: true },
          { surface: 'ます', base: 'ます', reading: 'ます', pos: '助動詞', lookup: false },
        ],
      },
    ],
  ];
  const matches = matchSentenceGrammar(sentences, withNari);
  assert.deepEqual(matches, []);
});
