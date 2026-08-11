import type { Vocabulary } from '@/types';

export const mockVocabulary: Vocabulary[] = [
  {
    id: 'word-nihon',
    slug: 'nihon',
    surface: '日本',
    reading: 'にほん',
    romaji: 'nihon',
    language: 'ja',
    direction: 'jp-vn',
    meanings: ['Nhật Bản', 'nước Nhật'],
    partOfSpeech: [
      { code: 'noun', labelVi: 'Danh từ', labelJa: '名詞' },
      { code: 'proper-noun', labelVi: 'Danh từ riêng', labelJa: '固有名詞' }
    ],
    jlpt: 'N5',
    isCommon: true,
    pitchAccent: 'LHHH',
    audio: {
      src: '/mock-audio/nihon.mp3',
      durationMs: 2180,
      speaker: 'Nữ, Tokyo',
      waveform: [0.18, 0.34, 0.62, 0.88, 0.54, 0.42, 0.74, 0.92, 0.48, 0.24, 0.56, 0.76, 0.38, 0.2]
    },
    senses: [
      {
        id: 'sense-nihon-1',
        order: 1,
        meaningVi: 'Nhật Bản; quốc gia quần đảo ở Đông Á',
        noteVi: 'Cách đọc thông dụng nhất trong giao tiếp hiện đại.',
        domain: 'địa danh'
      }
    ],
    kanji: ['日', '本'],
    exampleIds: ['example-nihon-1', 'example-manabu-1'],
    relatedWordIds: ['word-manabu', 'word-benkyou'],
    searchAliases: ['日本', 'にほん', 'ニホン', 'nihon', 'Nhật Bản'],
    isSaved: true
  },
  {
    id: 'word-taberu',
    slug: 'taberu',
    surface: '食べる',
    reading: 'たべる',
    romaji: 'taberu',
    language: 'ja',
    direction: 'jp-vn',
    meanings: ['ăn', 'dùng bữa'],
    partOfSpeech: [
      { code: 'ichidan-verb', labelVi: 'Động từ nhóm 2', labelJa: '一段動詞' },
      { code: 'transitive', labelVi: 'Ngoại động từ', labelJa: '他動詞' }
    ],
    jlpt: 'N5',
    isCommon: true,
    pitchAccent: 'LHH',
    audio: {
      src: '/mock-audio/taberu.mp3',
      durationMs: 2410,
      speaker: 'Nữ, Tokyo',
      waveform: [0.12, 0.28, 0.52, 0.84, 0.66, 0.38, 0.58, 0.9, 0.76, 0.44, 0.26, 0.62, 0.48, 0.18]
    },
    senses: [
      {
        id: 'sense-taberu-1',
        order: 1,
        meaningVi: 'Ăn một món ăn hoặc dùng một bữa.',
        noteVi: 'Thường đi với trợ từ を để đánh dấu món được ăn.',
        domain: 'sinh hoạt'
      },
      {
        id: 'sense-taberu-2',
        order: 2,
        meaningVi: 'Sống bằng, kiếm sống bằng.',
        noteVi: 'Nghĩa mở rộng, xuất hiện trong một số cách nói.',
        domain: 'nghĩa mở rộng'
      }
    ],
    kanji: ['食'],
    exampleIds: ['example-taberu-1'],
    relatedWordIds: ['word-nihon', 'word-benkyou'],
    searchAliases: ['食べる', 'たべる', 'タベル', 'taberu', 'ăn'],
    isSaved: true,
    conjugationId: 'conjugation-taberu'
  },
  {
    id: 'word-omoshiroi',
    slug: 'omoshiroi',
    surface: '面白い',
    reading: 'おもしろい',
    romaji: 'omoshiroi',
    language: 'ja',
    direction: 'jp-vn',
    meanings: ['thú vị', 'hài hước', 'hay'],
    partOfSpeech: [
      { code: 'i-adjective', labelVi: 'Tính từ đuôi い', labelJa: 'い形容詞' }
    ],
    jlpt: 'N5',
    isCommon: true,
    pitchAccent: 'LHHHL',
    audio: {
      src: '/mock-audio/omoshiroi.mp3',
      durationMs: 2860,
      speaker: 'Nam, Tokyo',
      waveform: [0.2, 0.48, 0.7, 0.42, 0.84, 0.62, 0.36, 0.78, 0.96, 0.54, 0.4, 0.72, 0.46, 0.22]
    },
    senses: [
      {
        id: 'sense-omoshiroi-1',
        order: 1,
        meaningVi: 'Có sức hấp dẫn, làm người ta muốn biết hoặc xem tiếp.',
        noteVi: 'Dùng cho sách, phim, câu chuyện, ý tưởng và trải nghiệm.',
        domain: 'đánh giá'
      },
      {
        id: 'sense-omoshiroi-2',
        order: 2,
        meaningVi: 'Buồn cười, hài hước.',
        noteVi: 'Sắc thái tùy ngữ cảnh.',
        domain: 'cảm xúc'
      }
    ],
    kanji: ['面', '白'],
    exampleIds: ['example-omoshiroi-1'],
    relatedWordIds: ['word-nihon', 'word-manabu'],
    searchAliases: ['面白い', 'おもしろい', 'omoshiroi', 'thú vị', 'hay'],
    isSaved: false,
    conjugationId: 'conjugation-omoshiroi'
  },
  {
    id: 'word-manabu',
    slug: 'manabu',
    surface: '学ぶ',
    reading: 'まなぶ',
    romaji: 'manabu',
    language: 'ja',
    direction: 'vn-jp',
    meanings: ['học', 'tiếp thu', 'noi theo'],
    partOfSpeech: [
      { code: 'godan-verb', labelVi: 'Động từ nhóm 1', labelJa: '五段動詞' },
      { code: 'transitive', labelVi: 'Ngoại động từ', labelJa: '他動詞' }
    ],
    jlpt: 'N4',
    isCommon: true,
    pitchAccent: 'LHH',
    audio: {
      src: '/mock-audio/manabu.mp3',
      durationMs: 2300,
      speaker: 'Nam, Tokyo',
      waveform: [0.16, 0.36, 0.68, 0.86, 0.52, 0.28, 0.64, 0.82, 0.58, 0.34, 0.74, 0.5, 0.3, 0.14]
    },
    senses: [
      {
        id: 'sense-manabu-1',
        order: 1,
        meaningVi: 'Học kiến thức hoặc kỹ năng một cách có ý thức.',
        noteVi: 'Trang trọng và rộng nghĩa hơn 勉強する trong một số ngữ cảnh.',
        domain: 'giáo dục'
      },
      {
        id: 'sense-manabu-2',
        order: 2,
        meaningVi: 'Rút ra bài học từ kinh nghiệm hoặc từ người khác.',
        noteVi: 'Có thể dịch là học hỏi hoặc noi theo.',
        domain: 'kinh nghiệm'
      }
    ],
    kanji: ['学'],
    exampleIds: ['example-manabu-1'],
    relatedWordIds: ['word-benkyou', 'word-nihon'],
    searchAliases: ['学ぶ', 'まなぶ', 'manabu', 'học', 'hoc', 'học hỏi'],
    isSaved: true,
    conjugationId: 'conjugation-manabu'
  },
  {
    id: 'word-benkyou',
    slug: 'benkyou-suru',
    surface: '勉強する',
    reading: 'べんきょうする',
    romaji: 'benkyou suru',
    language: 'ja',
    direction: 'vn-jp',
    meanings: ['học bài', 'nghiên cứu', 'chăm học'],
    partOfSpeech: [
      { code: 'suru-verb', labelVi: 'Động từ する', labelJa: 'サ変動詞' },
      { code: 'transitive', labelVi: 'Ngoại động từ', labelJa: '他動詞' }
    ],
    jlpt: 'N5',
    isCommon: true,
    pitchAccent: 'LHHHH',
    audio: {
      src: '/mock-audio/benkyou-suru.mp3',
      durationMs: 3180,
      speaker: 'Nữ, Tokyo',
      waveform: [0.1, 0.32, 0.58, 0.8, 0.46, 0.72, 0.92, 0.64, 0.38, 0.76, 0.54, 0.86, 0.42, 0.18]
    },
    senses: [
      {
        id: 'sense-benkyou-1',
        order: 1,
        meaningVi: 'Học tập, nghiên cứu để tiếp thu kiến thức.',
        noteVi: 'Từ thường dùng nhất cho hành động học trong ngữ cảnh thường ngày.',
        domain: 'giáo dục'
      },
      {
        id: 'sense-benkyou-2',
        order: 2,
        meaningVi: 'Nỗ lực, cố gắng trong công việc.',
        noteVi: 'Dùng trong ngữ cảnh công việc, kinh doanh.',
        domain: 'công việc'
      }
    ],
    kanji: ['勉', '強'],
    exampleIds: ['example-benkyou-1'],
    relatedWordIds: ['word-manabu', 'word-taberu'],
    searchAliases: ['勉強する', 'べんきょうする', 'benkyou suru', 'benkyou', 'học', 'học bài'],
    isSaved: false,
    conjugationId: 'conjugation-benkyou'
  }
];