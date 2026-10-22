export type Book = {
  slug: string;
  title: string;
  japaneseTitle: string;
  author: string;
  romanizedAuthor: string;
  minutes?: number;
  orthography?: string;
  titleReading?: string;
  credits?: string;
  category: string;
  intro: string;
  excerpt: string;
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

// Self-curated titles, themes and Vietnamese introductions. Reading times are estimates.
// Full texts are fetched on demand by the server, never stored in the application database.
export const books: Book[] = [
  { slug: 'kyonen-no-ki', title: 'Cái cây năm ngoái', japaneseTitle: '去年の木', author: '新美南吉', romanizedAuthor: 'Niimi Nankichi', minutes: 3, category: 'Truyện ngắn', intro: 'Một truyện ngắn dịu dàng về ký ức và điều ta để lại cho nhau.', excerpt: 'いっぽんの木と、いちわの小鳥とはたいへんなかよしでした。小鳥はいちんちその木の枝で歌をうたい、木はいちんちじゅう小鳥の歌をきいていました。' },
  { slug: 'nihiki-no-kaeru', title: 'Hai con ếch', japaneseTitle: '二ひきの蛙', author: '新美南吉', romanizedAuthor: 'Niimi Nankichi', minutes: 4, category: 'Truyện ngắn', intro: 'Hai người bạn nhìn thế giới bằng hai màu sắc khác nhau.', excerpt: '緑の蛙と黄色の蛙が、はたけのまんなかでばったりゆきあいました。「やあ、きみは黄色だね。きたない色だ。」と緑の蛙がいいました。' },
  { slug: 'amedama', title: 'Kẹo viên', japaneseTitle: '飴だま', author: '新美南吉', romanizedAuthor: 'Niimi Nankichi', minutes: 4, category: 'Truyện ngắn', intro: 'Một cuộc gặp nhỏ trên chuyến đò, và lòng tốt không cần lời giải thích.', excerpt: '春のあたたかい日のこと、わたし舟にふたりの小さな子どもをつれた女の旅人がのりました。' },
  { slug: 'gon-gitsune', title: 'Cáo Gon', japaneseTitle: 'ごん狐', author: '新美南吉', romanizedAuthor: 'Niimi Nankichi', minutes: 19, category: 'Chuyện loài vật', intro: 'Chú cáo nhỏ âm thầm tìm cách bù đắp cho một người dân làng.', excerpt: 'これは、私が小さいときに、村の茂平というおじいさんからきいたお話です。' },
  { slug: 'tebukuro-o-kai-ni', title: 'Đi mua găng tay', japaneseTitle: '手袋を買いに', author: '新美南吉', romanizedAuthor: 'Niimi Nankichi', minutes: 14, category: 'Chuyện loài vật', intro: 'Một cáo con lần đầu bước vào thị trấn mùa đông để mua găng tay.', excerpt: '寒い冬が北方から、狐の親子の棲んでいる森へもやって来ました。' },
  { slug: 'chumon-no-ooi-ryoriten', title: 'Nhà hàng có nhiều yêu cầu', japaneseTitle: '注文の多い料理店', author: '宮沢賢治', romanizedAuthor: 'Miyazawa Kenji', minutes: 22, category: 'Kỳ ảo và huyền bí', intro: 'Hai người thợ săn bước vào một nhà hàng kỳ lạ giữa rừng sâu.', excerpt: '二人の若い紳士が、すっかりイギリスの兵隊のかたちをして、ぴかぴかする鉄砲をかついで、白熊のような犬を二疋つれて、だいぶ山奥の、木の葉のかさかさしたとこを、こんなことを云いながら、あるいておりました。' },
  { slug: 'majutsu', title: 'Ma thuật', japaneseTitle: '魔術', author: '芥川龍之介', romanizedAuthor: 'Akutagawa Ryūnosuke', minutes: 29, category: 'Kỳ ảo và huyền bí', intro: 'Một bài học về phép thuật, lòng tham và giới hạn của con người.', excerpt: 'ある時雨の降る晩のことです。私を乗せた人力車は、何度も大森界隈の険しい坂を上ったり下りたりして、やっと竹藪に囲まれた、小さな西洋館の前に梶棒を下しました。' },
  { slug: 'momotaro', title: 'Momotaro', japaneseTitle: '桃太郎', author: '楠山正雄', romanizedAuthor: 'Kusuyama Masao', minutes: 18, category: 'Chuyện xưa và truyền thuyết', intro: 'Cậu bé sinh ra từ quả đào lên đường đến đảo quỷ.', excerpt: 'むかし、むかし、あるところに、おじいさんとおばあさんがありました。まいにち、おじいさんは山へしば刈りに、おばあさんは川へ洗濯に行きました。' },
  { slug: 'hashire-merosu', title: 'Chạy đi, Melos', japaneseTitle: '走れメロス', author: '太宰治', romanizedAuthor: 'Dazai Osamu', minutes: 39, category: 'Lòng tốt và tình người', intro: 'Melos chạy đua với thời gian để giữ lời hứa với người bạn.', excerpt: 'メロスは激怒した。必ず、かの邪智暴虐の王を除かなければならぬと決意した。' },
  { slug: 'torokko', title: 'Chiếc xe goòng', japaneseTitle: 'トロッコ', author: '芥川龍之介', romanizedAuthor: 'Akutagawa Ryūnosuke', minutes: 17, category: 'Tuổi thơ và đời thường', intro: 'Một cậu bé theo đoàn xe goòng và đi xa hơn mình tưởng.', excerpt: '小田原熱海間に、軽便鉄道敷設の工事が始まったのは、良平の八つの年だった。良平は毎日村外れへ、その工事を見物に行った。' },
  { slug: 'hana', title: 'Cái mũi', japaneseTitle: '鼻', author: '芥川龍之介', romanizedAuthor: 'Akutagawa Ryūnosuke', minutes: 23, category: 'Tâm lý và nhân tính', intro: 'Một nhà sư bận lòng vì chiếc mũi khác thường của mình.', excerpt: '禅智内供の鼻と云えば、池の尾で知らない者はない。' },
  { slug: 'aguni-no-kami', title: 'Thần Agni', japaneseTitle: 'アグニの神', author: '芥川龍之介', romanizedAuthor: 'Akutagawa Ryūnosuke', minutes: 32, category: 'Trinh thám và rùng rợn', intro: 'Một câu chuyện bí ẩn xoay quanh lời tiên tri và vị thần cổ.', excerpt: '支那の上海の或町です。昼でも薄暗い或家の二階に、人相の悪い印度人の婆さんが一人、商人らしい一人の亜米利加人と何か頻に話し合っていました。' },
  { slug: 'kaze-no-matasaburo', title: 'Matasaburo, cậu bé gió', japaneseTitle: '風の又三郎', author: '宮沢賢治', romanizedAuthor: 'Miyazawa Kenji', minutes: 120, category: 'Truyện dài, đọc dần', intro: 'Cậu bé mới đến trường làng dường như mang theo cả gió trời.', excerpt: 'どっどど　どどうど　どどうど　どどう\n青いくるみも吹きとばせ\nすっぱいかりんも吹きとばせ\nどっどど　どどうど　どどうど　どどう' },
];

export function getBook(slug: string) {
  return books.find((book) => book.slug === slug);
}
