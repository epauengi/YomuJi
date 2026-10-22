export type Book = {
  slug: string;
  title: string;
  japaneseTitle: string;
  author: string;
  romanizedAuthor: string;
  minutes: number;
  category: string;
  intro: string;
  excerpt: string;
  source?: string;
};

export const bookCategories = [
  'Truyện ngắn',
  'Chuyện loài vật',
  'Kỳ ảo và huyền bí',
  'Chuyện xưa và truyền thuyết',
  'Lòng tốt và tình người',
  'Tuổi thơ và đời thường',
  'Tâm lý và nhân tính',
  'Trinh thám và rùng rợn',
  'Truyện dài, đọc dần',
] as const;

// Minimal local demo dataset. Counts and reading copy are illustrative, not a complete catalog.
export const books: Book[] = [
  { slug: 'kyonen-no-ki', title: 'Cái cây năm ngoái', japaneseTitle: '去年の木', author: '新美南吉', romanizedAuthor: 'Niimi Nankichi', minutes: 3, category: 'Truyện ngắn', intro: 'Một truyện ngắn dịu dàng về ký ức và điều ta để lại cho nhau.', excerpt: '去年の木は、静かな丘の上に立っていました。風が吹くたび、枝の小さな葉が揺れました。' },
  { slug: 'nihiki-no-kaeru', title: 'Hai con ếch', japaneseTitle: '二ひきの蛙', author: '新美南吉', romanizedAuthor: 'Niimi Nankichi', minutes: 4, category: 'Truyện ngắn', intro: 'Hai người bạn nhìn thế giới bằng hai màu sắc khác nhau.', excerpt: '池のそばに、二ひきの蛙が住んでいました。春になると、二ひきは外へ出ました。' },
  { slug: 'amedama', title: 'Kẹo viên', japaneseTitle: '飴だま', author: '新美南吉', romanizedAuthor: 'Niimi Nankichi', minutes: 4, category: 'Truyện ngắn', intro: 'Một cuộc gặp nhỏ trên chuyến đò, và lòng tốt không cần lời giải thích.', excerpt: 'お母さんと子どもは、小さな船に乗って川を渡っていました。' },
  { slug: 'gon-gitsune', title: 'Cáo Gon', japaneseTitle: 'ごん狐', author: '新美南吉', romanizedAuthor: 'Niimi Nankichi', minutes: 19, category: 'Chuyện loài vật', intro: 'Chú cáo nhỏ âm thầm tìm cách bù đắp cho một người dân làng.', excerpt: 'これは、わたしが小さいときに、村の茂平というおじいさんから聞いたお話です。' },
  { slug: 'tebukuro-o-kai-ni', title: 'Đi mua găng tay', japaneseTitle: '手袋を買いに', author: '新美南吉', romanizedAuthor: 'Niimi Nankichi', minutes: 14, category: 'Chuyện loài vật', intro: 'Một cáo con lần đầu bước vào thị trấn mùa đông để mua găng tay.', excerpt: '寒い冬が北方から、狐の親子のすんでいる森へやって来ました。' },
  { slug: 'chumon-no-ooi-ryoriten', title: 'Nhà hàng có nhiều yêu cầu', japaneseTitle: '注文の多い料理店', author: '宮沢賢治', romanizedAuthor: 'Miyazawa Kenji', minutes: 22, category: 'Kỳ ảo và huyền bí', intro: 'Hai người thợ săn bước vào một nhà hàng kỳ lạ giữa rừng sâu.', excerpt: '二人の若い紳士が、すっかりイギリスの兵隊のかたちをして、ぴかぴかする鉄砲をかついでいました。' },
  { slug: 'majutsu', title: 'Ma thuật', japaneseTitle: '魔術', author: '芥川龍之介', romanizedAuthor: 'Akutagawa Ryūnosuke', minutes: 29, category: 'Kỳ ảo và huyền bí', intro: 'Một bài học về phép thuật, lòng tham và giới hạn của con người.', excerpt: 'ある晩、私は友人と一緒に、静かな部屋で不思議な話を聞きました。' },
  { slug: 'momotaro', title: 'Momotaro', japaneseTitle: '桃太郎', author: '楠山正雄', romanizedAuthor: 'Kusuyama Masao', minutes: 18, category: 'Chuyện xưa và truyền thuyết', intro: 'Cậu bé sinh ra từ quả đào lên đường đến đảo quỷ.', excerpt: 'むかしむかし、あるところに、おじいさんとおばあさんが住んでいました。' },
  { slug: 'hashire-merosu', title: 'Chạy đi, Melos', japaneseTitle: '走れメロス', author: '太宰治', romanizedAuthor: 'Dazai Osamu', minutes: 39, category: 'Lòng tốt và tình người', intro: 'Melos chạy đua với thời gian để giữ lời hứa với người bạn.', excerpt: 'メロスは激怒した。必ず、かの邪智暴虐の王を除かなければならぬと決意した。' },
  { slug: 'torokko', title: 'Chiếc xe goòng', japaneseTitle: 'トロッコ', author: '芥川龍之介', romanizedAuthor: 'Akutagawa Ryūnosuke', minutes: 17, category: 'Tuổi thơ và đời thường', intro: 'Một cậu bé theo đoàn xe goòng và đi xa hơn mình tưởng.', excerpt: '良平は、二つになった時から、土工たちの使うトロッコに乗りたがっていた。' },
  { slug: 'hana', title: 'Cái mũi', japaneseTitle: '鼻', author: '芥川龍之介', romanizedAuthor: 'Akutagawa Ryūnosuke', minutes: 23, category: 'Tâm lý và nhân tính', intro: 'Một nhà sư bận lòng vì chiếc mũi khác thường của mình.', excerpt: '禅智内供の鼻と云えば、池の尾で知らない者はない。' },
  { slug: 'aguni-no-kami', title: 'Thần Agni', japaneseTitle: 'アグニの神', author: '芥川龍之介', romanizedAuthor: 'Akutagawa Ryūnosuke', minutes: 32, category: 'Trinh thám và rùng rợn', intro: 'Một câu chuyện bí ẩn xoay quanh lời tiên tri và vị thần cổ.', excerpt: '上海の町には、古い寺や不思議な話がたくさん残っています。' },
  { slug: 'kaze-no-matasaburo', title: 'Matasaburo, cậu bé gió', japaneseTitle: '風の又三郎', author: '宮沢賢治', romanizedAuthor: 'Miyazawa Kenji', minutes: 120, category: 'Truyện dài, đọc dần', intro: 'Cậu bé mới đến trường làng dường như mang theo cả gió trời.', excerpt: 'どっどど、どどうど、どどうど、どどう。青いくるみも吹きとばせ。' },
];

export function getBook(slug: string) {
  return books.find((book) => book.slug === slug);
}
