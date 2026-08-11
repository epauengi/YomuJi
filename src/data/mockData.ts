// Mock data for all pages
// This file contains all sample data for the dictionary app

// ==================== KANJI DATA ====================
export const mockKanjiData = {
  'shoku': {
    literal: '食',
    meanings: ['ăn', 'thức ăn', 'bữa ăn'],
    jlpt: 'N4' as const,
    strokeCount: 9,
    grade: 2,
    frequency: 84,
    unicode: 'U+98DF',
    radical: '食',
    onReadings: ['ショク', 'ジキ'],
    kunReadings: ['た.べる', 'く.う'],
    compounds: [
      { word: '食べる', reading: 'たべる', meaning: 'ăn', audio: true },
      { word: '食事', reading: 'しょくじ', meaning: 'bữa ăn', audio: true },
      { word: '食品', reading: 'しょくひん', meaning: 'thực phẩm', audio: true },
      { word: '食堂', reading: 'しょくどう', meaning: 'nhà ăn', audio: true },
      { word: '飲み物', reading: 'のみもの', meaning: 'đồ uống', audio: false },
    ],
    similarKanji: ['飲', '飯', '館'],
    strokeOrder: [
      { id: 1, path: 'M 30 20 Q 50 40 70 20' },
      { id: 2, path: 'M 50 20 L 50 80' },
      { id: 3, path: 'M 30 50 L 70 50' },
      { id: 4, path: 'M 20 80 L 80 80' },
    ],
  },
  'hon': {
    literal: '本',
    meanings: ['sách', 'gốc', 'nguồn'],
    jlpt: 'N5' as const,
    strokeCount: 5,
    grade: 1,
    frequency: 5,
    unicode: 'U+672C',
    radical: '木',
    onReadings: ['ホン'],
    kunReadings: ['もと'],
    compounds: [
      { word: '日本', reading: 'にほん', meaning: 'Nhật Bản', audio: true },
      { word: '本棚', reading: 'ほんだな', meaning: 'giá sách', audio: true },
      { word: '日本', reading: 'にほん', meaning: 'Nhật Bản', audio: true },
      { word: '基本', reading: 'きほん', meaning: 'cơ bản', audio: true },
      { word: '日本', reading: 'にほん', meaning: 'Nhật Bản', audio: true },
    ],
    similarKanji: ['木', '休', '体'],
    strokeOrder: [
      { id: 1, path: 'M 20 30 L 80 30' },
      { id: 2, path: 'M 50 10 L 50 90' },
      { id: 3, path: 'M 20 50 L 80 50' },
      { id: 4, path: 'M 30 70 L 70 70' },
      { id: 5, path: 'M 35 90 L 65 90' },
    ],
  },
  'kan': {
    literal: '漢',
    meanings: ['Trung Quốc', 'nam giới', 'Hán'],
    jlpt: 'N3' as const,
    strokeCount: 14,
    grade: 5,
    frequency: 156,
    unicode: 'U+6F22',
    radical: '水',
    onReadings: ['カン'],
    kunReadings: [],
    compounds: [
      { word: '漢字', reading: 'かんじ', meaning: 'chữ Hán', audio: true },
      { word: '漢語', reading: 'かんご', meaning: 'từ Hán', audio: true },
      { word: '漢方', reading: 'かんぽう', meaning: 'Đông y', audio: true },
      { word: '漢民族', reading: 'かんみんぞく', meaning: 'dân tộc Hán', audio: false },
      { word: '偉大', reading: 'いだい', meaning: 'vĩ đại', audio: false },
    ],
    similarKanji: ['嘆', '難', '漢'],
    strokeOrder: [],
  },
};

// ==================== CONJUGATION DATA ====================
export const mockConjugationData = {
  'taberu': {
    word: '食べる',
    reading: 'たべる',
    romaji: 'taberu',
    type: 'verb' as const,
    transitive: true,
    jlpt: 'N5' as const,
    conjugations: {
      basic: {
        affirmative: { plain: '食べる', polite: '食べます', romaji: { plain: 'taberu', polite: 'tabemasu' } },
        negative: { plain: '食べない', polite: '食べません', romaji: { plain: 'tabenai', polite: 'tabemasen' } },
      },
      teForm: {
        affirmative: { form: '食べて', romaji: 'tabete' },
        negative: { form: '食べなくて', romaji: 'tabenakute' },
      },
      past: {
        affirmative: { plain: '食べた', polite: '食べました', romaji: { plain: 'tabeta', polite: 'tabemashita' } },
        negative: { plain: '食べなかった', polite: '食べませんでした', romaji: { plain: 'tabenakatta', polite: 'tabemasendeshita' } },
      },
      conditional: {
        affirmative: { plain: '食べれば', romaji: 'tabereba' },
        negative: { plain: '食べなければ', romaji: 'tabenakereba' },
      },
      volitional: {
        affirmative: { plain: '食べよう', polite: '食べましょう', romaji: { plain: 'tabeyou', polite: 'tabemashou' } },
      },
      imperative: {
        affirmative: { plain: '食べろ', romaji: 'tabero' },
        negative: { plain: '食べるな', romaji: 'taberu na' },
      },
      potential: {
        affirmative: { plain: '食べられる', polite: '食べられます', romaji: { plain: 'taberareru', polite: 'taberaremasu' } },
        negative: { plain: '食べられない', polite: '食べられません', romaji: { plain: 'taberarenai', polite: 'taberaremasen' } },
      },
      passive: {
        affirmative: { plain: '食べられる', romaji: 'taberareru' },
        negative: { plain: '食べられない', romaji: 'taberarenai' },
      },
      causative: {
        affirmative: { plain: '食べさせる', romaji: 'tabesaseru' },
        negative: { plain: '食べさせない', romaji: 'tabesasenai' },
      },
    },
  },
  'manabu': {
    word: '学ぶ',
    reading: 'まなぶ',
    romaji: 'manabu',
    type: 'verb' as const,
    transitive: true,
    jlpt: 'N3' as const,
    conjugations: {
      basic: {
        affirmative: { plain: '学ぶ', polite: '学びます', romaji: { plain: 'manabu', polite: 'manabimasu' } },
        negative: { plain: '学ばない', polite: '学びません', romaji: { plain: 'manabanai', polite: 'manabimasen' } },
      },
      teForm: {
        affirmative: { form: '学んで', romaji: 'manande' },
        negative: { form: '学ばなくて', romaji: 'manabanakute' },
      },
      past: {
        affirmative: { plain: '学んだ', polite: '学びました', romaji: { plain: 'mananda', polite: 'manabimashita' } },
        negative: { plain: '学ばなかった', polite: '学びませんでした', romaji: { plain: 'manabanakatta', polite: 'manabimasendeshita' } },
      },
      conditional: {
        affirmative: { plain: '学べば', romaji: 'manabeba' },
        negative: { plain: '学ばなければ', romaji: 'manabanakereba' },
      },
      volitional: {
        affirmative: { plain: '学ぼう', polite: '学びましょう', romaji: { plain: 'manabou', polite: 'manabimashou' } },
      },
      imperative: {
        affirmative: { plain: '学べ', romaji: 'manabe' },
        negative: { plain: '学ぶな', romaji: 'manabu na' },
      },
      potential: {
        affirmative: { plain: '学べる', polite: '学べます', romaji: { plain: 'manaberu', polite: 'manabemasu' } },
        negative: { plain: '学べない', polite: '学べません', romaji: { plain: 'manabenai', polite: 'manabemasen' } },
      },
      passive: {
        affirmative: { plain: '学ばれる', romaji: 'manabareru' },
        negative: { plain: '学ばれない', romaji: 'manabarenai' },
      },
      causative: {
        affirmative: { plain: '学ばせる', romaji: 'manabaseru' },
        negative: { plain: '学ばせない', romaji: 'manabasanai' },
      },
    },
  },
  'omoshiroi': {
    word: '面白い',
    reading: 'おもしろい',
    romaji: 'omoshiroi',
    type: 'adjective' as const,
    jlpt: 'N5' as const,
    conjugations: {
      basic: {
        affirmative: { plain: '面白い', polite: '面白いです', romaji: { plain: 'omoshiroi', polite: 'omoshiroi desu' } },
        negative: { plain: '面白くない', polite: '面白くないです', romaji: { plain: 'omoshirokunai', polite: 'omoshirokunai desu' } },
      },
      teForm: {
        affirmative: { form: '面白くて', romaji: 'omoshirokute' },
        negative: { form: '面白くなくて', romaji: 'omoshirokunakute' },
      },
      past: {
        affirmative: { plain: '面白かった', polite: '面白かったです', romaji: { plain: 'omoshirokatta', polite: 'omoshirokatta desu' } },
        negative: { plain: '面白くなかった', polite: '面白くなかったですか', romaji: { plain: 'omoshirokunakatta', polite: 'omoshirokunakatta desu' } },
      },
      conditional: {
        affirmative: { plain: '面白ければ', romaji: 'omoshirokereba' },
        negative: { plain: '面白くなければ', romaji: 'omoshirokunakereba' },
      },
      volitional: {
        affirmative: { plain: '面白かろう', romaji: 'omoshirokarou' },
      },
      imperative: {
        affirmative: { plain: '面白くあれ', romaji: 'omoshiroku are' },
        negative: { plain: '面白くなるな', romaji: 'omoshiroku naruna' },
      },
      potential: {
        affirmative: { plain: '面白くなりうる', romaji: 'omoshiroku nariuru' },
        negative: { plain: '面白くなりえない', romaji: 'omoshiroku narienai' },
      },
      passive: {
        affirmative: { plain: '面白がられる', romaji: 'omoshirogarareru' },
        negative: { plain: '面白がられない', romaji: 'omoshirogararenai' },
      },
      causative: {
        affirmative: { plain: '面白くさせる', romaji: 'omoshiroku saseru' },
        negative: { plain: '面白くさせない', romaji: 'omoshiroku sasenai' },
      },
    },
  },
};

// ==================== FLASHCARD / SAVED WORDS DATA ====================
export const mockSavedWords = [
  {
    id: '1',
    word: '日本',
    reading: 'にほん',
    romaji: 'nihon',
    meaning: 'Nhật Bản',
    type: 'danh từ',
    jlpt: 'N5',
    savedAt: new Date('2024-01-15'),
    deck: 'n3-july',
    dueCount: 3,
  },
  {
    id: '2',
    word: '食べる',
    reading: 'たべる',
    romaji: 'taberu',
    meaning: 'ăn',
    type: 'động từ nhóm 2',
    jlpt: 'N5',
    savedAt: new Date('2024-01-14'),
    deck: 'n3-july',
    dueCount: 5,
  },
  {
    id: '3',
    word: '面白い',
    reading: 'おもしろい',
    romaji: 'omoshiroi',
    meaning: 'thú vị, hay',
    type: 'tính từ -i',
    jlpt: 'N5',
    savedAt: new Date('2024-01-13'),
    deck: 'jlpt-n5',
    dueCount: 2,
  },
  {
    id: '4',
    word: '勉強',
    reading: 'べんきょう',
    romaji: 'benkyou',
    meaning: 'học tập, nghiên cứu',
    type: 'danh từ, động từ',
    jlpt: 'N5',
    savedAt: new Date('2024-01-12'),
    deck: 'jlpt-n5',
    dueCount: 0,
  },
  {
    id: '5',
    word: '漢字',
    reading: 'かんじ',
    romaji: 'kanji',
    meaning: 'chữ Hán, chữ Kanji',
    type: 'danh từ',
    jlpt: 'N5',
    savedAt: new Date('2024-01-11'),
    deck: 'jlpt-n5',
    dueCount: 1,
  },
  {
    id: '6',
    word: '飲む',
    reading: 'のむ',
    romaji: 'nomu',
    meaning: 'uống',
    type: 'động từ nhóm 1',
    jlpt: 'N5',
    savedAt: new Date('2024-01-10'),
    deck: 'jlpt-n5',
    dueCount: 4,
  },
  {
    id: '7',
    word: '学校',
    reading: 'がっこう',
    romaji: 'gakkou',
    meaning: 'trường học',
    type: 'danh từ',
    jlpt: 'N5',
    savedAt: new Date('2024-01-09'),
    deck: 'jlpt-n5',
    dueCount: 0,
  },
  {
    id: '8',
    word: '友達',
    reading: 'ともだち',
    romaji: 'tomodachi',
    meaning: 'bạn bè',
    type: 'danh từ',
    jlpt: 'N5',
    savedAt: new Date('2024-01-08'),
    deck: 'jlpt-n5',
    dueCount: 2,
  },
];

export const mockDecks = [
  {
    id: 'n3-july',
    name: 'N3 Tháng 7',
    description: 'Từ vựng N3 cho kỳ thi tháng 7',
    cardCount: 45,
    dueCount: 12,
    masteredCount: 18,
    color: '#0F766E',
    createdAt: new Date('2024-06-01'),
  },
  {
    id: 'jlpt-n5',
    name: 'JLPT N5 Core',
    description: '300 từ vựng N5 phổ biến nhất',
    cardCount: 300,
    dueCount: 25,
    masteredCount: 120,
    color: '#15803D',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: 'business-jp',
    name: 'Business Japanese',
    description: 'Từ vựng tiếng Nhật thương mại',
    cardCount: 80,
    dueCount: 8,
    masteredCount: 35,
    color: '#1D4ED8',
    createdAt: new Date('2024-03-15'),
  },
  {
    id: 'travel-jp',
    name: 'Du lịch Nhật Bản',
    description: 'Cụm từ và từ vựng du lịch',
    cardCount: 60,
    dueCount: 15,
    masteredCount: 20,
    color: '#A16207',
    createdAt: new Date('2024-05-01'),
  },
];

// ==================== REVIEW DATA ====================
export const mockReviewQueue = [
  {
    id: '1',
    word: '日本',
    reading: 'にほん',
    romaji: 'nihon',
    meaning: 'Nhật Bản',
    type: 'danh từ',
    jlpt: 'N5',
    example: '日本人は親切です。',
    exampleMeaning: 'Người Nhật thân thiện.',
    interval: 1,
    easeFactor: 2.5,
    dueDate: new Date(),
  },
  {
    id: '2',
    word: '食べる',
    reading: 'たべる',
    romaji: 'taberu',
    meaning: 'ăn',
    type: 'động từ',
    jlpt: 'N5',
    example: '朝ごはんを食べます。',
    exampleMeaning: 'Tôi ăn sáng.',
    interval: 3,
    easeFactor: 2.6,
    dueDate: new Date(),
  },
  {
    id: '3',
    word: '面白い',
    reading: 'おもしろい',
    romaji: 'omoshiroi',
    meaning: 'thú vị',
    type: 'tính từ',
    jlpt: 'N5',
    example: 'この映画は面白いです。',
    exampleMeaning: 'Bộ phim này thú vị.',
    interval: 1,
    easeFactor: 2.3,
    dueDate: new Date(),
  },
  {
    id: '4',
    word: '飲む',
    reading: 'のむ',
    romaji: 'nomu',
    meaning: 'uống',
    type: 'động từ',
    jlpt: 'N5',
    example: '水を飲みます。',
    exampleMeaning: 'Tôi uống nước.',
    interval: 7,
    easeFactor: 2.8,
    dueDate: new Date(),
  },
  {
    id: '5',
    word: '漢字',
    reading: 'かんじ',
    romaji: 'kanji',
    meaning: 'chữ Hán',
    type: 'danh từ',
    jlpt: 'N5',
    example: '漢字を勉強しています。',
    exampleMeaning: 'Tôi đang học chữ Hán.',
    interval: 2,
    easeFactor: 2.4,
    dueDate: new Date(),
  },
];

// ==================== HISTORY DATA ====================
export const mockHistory = [
  {
    id: '1',
    query: '日本',
    reading: 'にほん',
    direction: 'ja-vi' as const,
    resultCount: 5,
    timestamp: new Date(),
  },
  {
    id: '2',
    query: '食べる',
    reading: 'たべる',
    direction: 'ja-vi' as const,
    resultCount: 3,
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
  },
  {
    id: '3',
    query: 'học',
    reading: 'まなぶ',
    direction: 'vi-ja' as const,
    resultCount: 8,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
  },
  {
    id: '4',
    query: '面白い',
    reading: 'おもしろい',
    direction: 'ja-vi' as const,
    resultCount: 2,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
  },
  {
    id: '5',
    query: '学校',
    reading: 'がっこう',
    direction: 'ja-vi' as const,
    resultCount: 4,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
  },
  {
    id: '6',
    query: '友達',
    reading: 'ともだち',
    direction: 'ja-vi' as const,
    resultCount: 6,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2), // 2 days ago
  },
  {
    id: '7',
    query: 'du lịch',
    reading: 'りょこう',
    direction: 'vi-ja' as const,
    resultCount: 12,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
  },
  {
    id: '8',
    query: '漢字',
    reading: 'かんじ',
    direction: 'ja-vi' as const,
    resultCount: 7,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5), // 5 days ago
  },
  {
    id: '9',
    query: '飲む',
    reading: 'のむ',
    direction: 'ja-vi' as const,
    resultCount: 3,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), // 1 week ago
  },
  {
    id: '10',
    query: '勉強',
    reading: 'べんきょう',
    direction: 'ja-vi' as const,
    resultCount: 9,
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10), // 10 days ago
  },
];

// ==================== STUDY STATS ====================
export const mockStudyStats = {
  totalWords: 127,
  masteredWords: 45,
  dueToday: 23,
  streak: 12,
  accuracy: 87,
  weeklyProgress: [
    { day: 'T2', learned: 15, reviewed: 45 },
    { day: 'T3', learned: 12, reviewed: 38 },
    { day: 'T4', learned: 18, reviewed: 52 },
    { day: 'T5', learned: 10, reviewed: 42 },
    { day: 'T6', learned: 14, reviewed: 48 },
    { day: 'T7', learned: 20, reviewed: 60 },
    { day: 'CN', learned: 8, reviewed: 35 },
  ],
};

// ==================== SEARCH SUGGESTIONS ====================
export const mockSearchSuggestions = [
  { query: '日本', type: 'kanji' as const },
  { query: '食べる', type: 'verb' as const },
  { query: '面白い', type: 'adjective' as const },
  { query: '漢字', type: 'noun' as const },
  { query: '学校', type: 'noun' as const },
];

// ==================== UI STATES ====================
export const mockUIStates = {
  loading: {
    skeleton: true,
    spinner: false,
    progress: false,
  },
  empty: {
    noResults: true,
    noHistory: true,
    noSavedWords: true,
  },
  error: {
    network: true,
    notFound: true,
    serverError: true,
  },
  success: {
    saved: true,
    copied: true,
    deleted: true,
  },
};