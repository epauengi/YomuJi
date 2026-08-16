'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  ArrowClockwise,
  ArrowSquareOut,
  BookOpenText,
  BookmarkSimple,
  CaretRight,
  ClockCounterClockwise,
  Fire,
  Globe,
  GraduationCap,
  Sparkle,
  SpeakerHigh,
  Trash,
  Translate,
} from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { SearchInput } from '@/components/SearchInput';
import { TermCard } from '@/components/dictionary/TermCard';
import { TiltCard } from '@/components/ui/TiltCard';
import { NumberTicker } from '@/components/ui/NumberTicker';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { AudioButton } from '@/components/AudioButton';
import { InteractiveJapaneseReader } from '@/components/dictionary/InteractiveJapaneseReader';
import { useDictionary, getPopularTerms, searchDictionary, getWordOfTheDay } from '@/lib/mockDictionary';
import { playJapaneseAudio } from '@/lib/tts';
import type { DictionarySearchResult, TermRecord } from '@/types/dictionary';

const jlptLevels = [
  { level: 'N5', label: 'Cơ bản', color: 'from-emerald-500/10 to-emerald-500/5', border: 'hover:border-emerald-400', badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300', count: 800 },
  { level: 'N4', label: 'Sơ cấp', color: 'from-teal-500/10 to-teal-500/5', border: 'hover:border-teal-400', badge: 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300', count: 1500 },
  { level: 'N3', label: 'Trung cấp', color: 'from-blue-500/10 to-blue-500/5', border: 'hover:border-blue-400', badge: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300', count: 3750 },
  { level: 'N2', label: 'Thượng cấp', color: 'from-amber-500/10 to-amber-500/5', border: 'hover:border-amber-400', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300', count: 6000 },
  { level: 'N1', label: 'Cao cấp', color: 'from-rose-500/10 to-rose-500/5', border: 'hover:border-rose-400', badge: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300', count: 10000 },
];

const decorativeKanji = [
  { char: '学', top: '15%', left: '8%', size: 'text-5xl md:text-6xl', opacity: 'opacity-[0.04]', anim: 'animate-kanji-slow', blur: 'blur-[0.5px]' },
  { char: '語', top: '18%', right: '10%', size: 'text-6xl md:text-7xl', opacity: 'opacity-[0.04]', anim: 'animate-kanji-rev', blur: 'blur-[1px]' },
  { char: '辞', top: '65%', left: '10%', size: 'text-5xl md:text-6xl', opacity: 'opacity-[0.035]', anim: 'animate-kanji-rev', blur: 'none' },
  { char: '日', top: '60%', right: '12%', size: 'text-5xl md:text-6xl', opacity: 'opacity-[0.04]', anim: 'animate-kanji-slow', blur: 'none' },
];

const suggestionChips = ['食べる', '日本', '勉強', 'học tập'];

interface ArticleItem {
  title: string;
  extract: string;
  url: string;
}

const fallbackArticles: Record<string, ArticleItem> = {
  '日本': {
    title: '日本',
    extract: '日本国（にほんこく、にっぽんこく）、または日本（にほん、にっぽん）は、東アジアに位置する島国である。首都は東京都。太平洋と日本海、東シナ海、オホーツク海に囲まれている。四方を海に囲まれた島国であり、独自の歴史と豊かな自然文化を育んできた。四季が明確であり、春の桜、夏の青空、秋の紅葉、冬の雪景色など、年間を通じて多様な自然の表情を楽しむことができる。',
    url: 'https://ja.wikipedia.org/wiki/日本',
  },
  '富士山': {
    title: '富士山',
    extract: '富士山（ふじさん）は、山梨県と静岡県にまたがる独立峰であり、標高3,776 mの日本最高峰である。日本の象徴として古来より世界的に知られており、信仰の対象や芸術の源泉として2013年にユネスコの世界文化遺産に登録された。美しい円錐形の山容を誇り、新幹線や東京の高層ビル群からも望むことができる。',
    url: 'https://ja.wikipedia.org/wiki/富士山',
  },
  '桜': {
    title: '桜',
    extract: 'サクラ（桜）は、バラ科サクラ属の植物の総称、またはその花である。春に咲くピンクや白の美しい花で広く親しまれており、日本の国花の一つとされる。春になると全国各地で「花見」の習慣が行われ、人々が集まって満開の桜を楽しむ伝統が古くから受け継がれている。',
    url: 'https://ja.wikipedia.org/wiki/桜',
  },
  '東京': {
    title: '東京',
    extract: '東京（とうきょう）は、日本の首都であり、東京都の主要都市である。政治、経済、文化の中心地として世界最大級の都市圏を形成している。歴史ある神社仏閣と近代的な超高層ビル群が共存する世界有数の国際都市として、多くの観光客を魅了している。',
    url: 'https://ja.wikipedia.org/wiki/東京',
  },
  '新幹線': {
    title: '新幹線',
    extract: '新幹線（しんかんせん）は、JRグループが運営する日本の高速鉄道システムである。1964年の東京オリンピックに合わせて東海道新幹線が開業して以来、高い安全性と世界トップレベルの定時運行率を維持しており、日本の高度経済成長を支えた技術の結晶として称えられている。',
    url: 'https://ja.wikipedia.org/wiki/新幹線',
  },
};

async function fetchRandomWikiArticle(): Promise<ArticleItem> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://ja.wikipedia.org/api/rest_v1/page/random/summary`, {
        headers: { 'Accept': 'application/json' },
        cache: 'no-store',
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.extract && data.extract.trim().length > 30 && data.type === 'standard') {
          return {
            title: data.title || data.displaytitle || 'Wikipedia',
            extract: data.extract,
            url: data.content_urls?.desktop?.page || `https://ja.wikipedia.org/wiki/${encodeURIComponent(data.title)}`,
          };
        }
      }
    } catch (err) {
      console.error('Random Wiki fetch error:', err);
    }
  }

  const fallbackKeys = Object.keys(fallbackArticles);
  const randomKey = fallbackKeys[Math.floor(Math.random() * fallbackKeys.length)];
  return fallbackArticles[randomKey];
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.03,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(3px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function HomePage() {
  const { isReady, progress } = useDictionary();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DictionarySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [wordOfTheDay, setWordOfTheDay] = useState<TermRecord | null>(null);
  const [isSavedWotd, setIsSavedWotd] = useState(false);

  const [readingArticle, setReadingArticle] = useState<ArticleItem | null>(null);
  const [readingLoading, setReadingLoading] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  const loadNewRandomArticle = async () => {
    setReadingLoading(true);
    const article = await fetchRandomWikiArticle();
    setReadingArticle(article);
    setReadingLoading(false);
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('yomuji_recent_searches');
        if (saved) setRecentSearches(JSON.parse(saved));
      } catch (err) {
        console.error(err);
      }
    }
    getWordOfTheDay().then(setWordOfTheDay);
    loadNewRandomArticle();
  }, []);

  const handleNextArticle = () => {
    loadNewRandomArticle();
  };

  const addRecentSearch = (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setRecentSearches((prev) => {
      const next = [trimmed, ...prev.filter((item) => item !== trimmed)].slice(0, 8);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('yomuji_recent_searches', JSON.stringify(next));
        } catch (err) {
          console.error(err);
        }
      }
      return next;
    });
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('yomuji_recent_searches');
      } catch (err) {
        console.error(err);
      }
    }
  };

  const playPronunciation = (text: string) => {
    playJapaneseAudio(text);
  };

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;

    async function run() {
      setLoading(true);
      const next = query.trim()
        ? await searchDictionary(query, 12)
        : await getPopularTerms(12);

      if (!cancelled) {
        setResults(next);
        setLoading(false);
        if (query.trim()) {
          addRecentSearch(query.trim());
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isReady, query]);

  return (
    <div className="pb-16">
      <section
        onMouseMove={handleMouseMove}
        className="relative z-20 bg-[#123b36] py-10 sm:py-12 md:py-14 text-white shadow-md select-none"
      >
        <div className="hero-background pointer-events-none absolute inset-0 overflow-hidden">
          <div className="hero-orb animate-orb-3 absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle_at_center,rgba(45,212,191,0.22)_0%,transparent_65%)] blur-3xl" />

          <div
            className="absolute inset-0 transition-transform duration-500 ease-out"
            style={{
              transform: `translate3d(${mousePos.x * 12}px, ${mousePos.y * 12}px, 0)`,
            }}
          >
            {decorativeKanji.map((item, index) => (
              <span
                key={`${item.char}-${index}`}
                aria-hidden="true"
                style={{
                  top: item.top,
                  left: item.left,
                  right: item.right,
                }}
                className={`floating-kanji-char absolute jp-text font-black leading-none text-white ${item.size} ${item.opacity} ${item.anim} ${item.blur}`}
              >
                {item.char}
              </span>
            ))}
          </div>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="relative z-10 mx-auto flex max-w-4xl flex-col items-center justify-center px-4 text-center"
        >
          <motion.div variants={itemVariants}>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl text-balance">
              Tra nhanh, hiểu sâu{' '}
              <span className="relative inline-block bg-gradient-to-r from-teal-200 via-teal-100 to-emerald-300 bg-clip-text text-transparent pb-1">
                tiếng Nhật
                <motion.span
                  className="absolute bottom-0 left-0 h-[3px] w-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-400 opacity-80"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: 0.5, duration: 0.6, ease: 'easeOut' }}
                />
              </span>
            </h1>
          </motion.div>

          <motion.div variants={itemVariants}>
            <p className="mt-3 max-w-xl text-sm leading-6 text-teal-100/90 sm:text-base">
              Tra từ vựng, Kanji, romaji hoặc tiếng Việt trong một ô tìm kiếm.
            </p>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-6 w-full max-w-[800px] text-left">
            <SearchInput
              onSearch={setQuery}
              initialValue={query}
              placeholder="Nhập Kanji, kana, romaji hoặc nghĩa tiếng Việt..."
            />

            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2 text-xs font-medium text-teal-100/80">
              <span className="text-teal-200/90">Thử tìm:</span>
              {suggestionChips.map((word) => (
                <button
                  key={word}
                  type="button"
                  onClick={() => setQuery(word)}
                  className="tactile rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium text-teal-50 transition-all duration-200 hover:border-teal-300/50 hover:bg-white/25 hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-400/40"
                >
                  {word}
                </button>
              ))}
            </div>
          </motion.div>
        </motion.div>
      </section>

      <main className="mx-auto max-w-[1120px] px-4 py-8">
        {query.trim() ? (
          <section aria-label="Kết quả tìm kiếm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-[var(--color-text-primary)]">
                  Kết quả tra cứu cho &ldquo;{query}&rdquo;
                </h2>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Tìm thấy {results.length} từ phù hợp trong dữ liệu
                </p>
              </div>
            </div>

            <div aria-live="polite">
              {!isReady ? (
                <div className="rounded-[--radius-lg] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-[var(--color-text-secondary)]">
                  {progress.message}
                </div>
              ) : loading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="skeleton-quiet h-36 rounded-[--radius-lg] bg-[var(--color-surface-subtle)]" />
                  ))}
                </div>
              ) : results.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {results.map((result, index) => (
                    <div key={result.term.id} className="result-enter" style={{ '--result-index': index } as CSSProperties}>
                      <TermCard term={result.term} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[--radius-lg] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center text-[var(--color-text-secondary)]">
                  Không tìm thấy kết quả nào phù hợp với từ khóa &ldquo;{query}&rdquo;.
                </div>
              )}
            </div>
          </section>
        ) : (
          <div className="space-y-10">
            {recentSearches.length > 0 && (
              <section aria-label="Tìm kiếm gần đây">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-text-secondary)]">
                    <ClockCounterClockwise size={18} weight="bold" className="text-[var(--color-primary-700)]" />
                    <span>Tìm kiếm gần đây</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearRecentSearches}
                    className="flex items-center gap-1 text-xs font-semibold text-[var(--color-text-muted)] transition-colors hover:text-red-500"
                  >
                    <Trash size={14} />
                    <span>Xóa lịch sử</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {recentSearches.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setQuery(item)}
                      className="surface-lift rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-1.5 text-sm font-medium text-[var(--color-text-primary)] transition-all hover:border-[var(--color-primary-400)] hover:bg-[var(--color-surface-subtle)]"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Bento Grid Dashboard: Row 1 (Word of the day + Wikipedia Interactive Reader) */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(340px,2.2fr)] items-stretch">
              {wordOfTheDay && (
                <TiltCard className="p-6 sm:p-7 shadow-sm">
                  <div className="flex h-full flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-50)] px-3.5 py-1 text-xs font-bold text-[var(--color-primary-700)] dark:bg-[var(--color-primary-950)] dark:text-[var(--color-primary-300)]">
                          <Sparkle size={14} weight="duotone" />
                          Từ vựng hôm nay
                        </div>
                        <div className="rounded-full bg-[var(--color-surface-subtle)] px-3 py-1 text-xs font-bold text-[var(--color-text-secondary)]">
                          {wordOfTheDay.isCommon ? 'Phổ biến • N5' : 'JLPT'}
                        </div>
                      </div>

                      <div className="mt-5 flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-baseline gap-3">
                            <motion.h3
                              layoutId={`term-surface-${wordOfTheDay.id}`}
                              className="jp-text text-4xl font-extrabold text-[var(--color-primary-800)] dark:text-[var(--color-primary-300)]"
                              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                            >
                              {wordOfTheDay.surface}
                            </motion.h3>
                            <span className="jp-text text-base font-semibold text-[var(--color-text-secondary)]">
                              {wordOfTheDay.reading}
                            </span>
                          </div>

                          <p className="mt-2 text-lg font-bold text-[var(--color-text-primary)]">
                            {wordOfTheDay.meaningsVi.join(', ')}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <AudioButton text={wordOfTheDay.surface} label="Phát âm" variant="icon-only" />
                          <BookmarkButton word={wordOfTheDay.surface} />
                        </div>
                      </div>

                      {wordOfTheDay.examples && wordOfTheDay.examples.length > 0 && (
                        <div className="mt-5 rounded-[--radius-md] bg-[var(--color-surface-subtle)] p-3.5 border border-[var(--color-border-subtle)]">
                          <p className="jp-text text-sm font-semibold text-[var(--color-text-primary)]">
                            {wordOfTheDay.examples[0].textJa}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
                            {wordOfTheDay.examples[0].textVi}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex justify-end pt-3 border-t border-[var(--color-border-subtle)]">
                      <Link
                        href={`/word/${encodeURIComponent(wordOfTheDay.surface)}`}
                        className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-primary-700)] dark:text-[var(--color-primary-400)] transition-colors hover:text-[var(--color-primary-800)]"
                      >
                        Xem chi tiết từ vựng
                        <CaretRight size={14} weight="bold" />
                      </Link>
                    </div>
                  </div>
                </TiltCard>
              )}

              {/* Interactive Japanese Reader Box */}
              <TiltCard className="p-6 sm:p-7 shadow-sm">
                <InteractiveJapaneseReader
                  title={readingArticle?.title || 'Đang tải...'}
                  extract={readingArticle?.extract || ''}
                  url={readingArticle?.url || ''}
                  onRefresh={handleNextArticle}
                  isLoading={readingLoading}
                />
              </TiltCard>
            </div>

            {/* Bento Grid Row 2: JLPT Quick Level Cards with Animated Number Counters */}
            <section aria-label="Tra cứu theo cấp độ JLPT">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GraduationCap size={20} weight="duotone" className="text-[var(--color-primary-700)]" />
                  <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                    Lộ trình & Cấp độ JLPT
                  </h3>
                </div>
                <Link
                  href="/jlpt"
                  className="text-xs font-bold text-[var(--color-primary-700)] dark:text-[var(--color-primary-400)] hover:underline"
                >
                  Xem tổng quan →
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
                {jlptLevels.map((jlpt, index) => (
                  <Link
                    key={jlpt.level}
                    href={`/jlpt`}
                    className={`group relative overflow-hidden rounded-[--radius-lg] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-md ${jlpt.border}`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-xl font-black text-[var(--color-text-primary)] group-hover:text-[var(--color-primary-700)] transition-colors">
                        {jlpt.level}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${jlpt.badge}`}>
                        {jlpt.label}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="text-lg font-extrabold text-[var(--color-primary-800)] dark:text-[var(--color-primary-300)]">
                        ~<NumberTicker value={jlpt.count} delay={0.2 + index * 0.1} />
                      </div>
                      <span className="text-[11px] font-medium text-[var(--color-text-muted)]">
                        từ vựng cốt lõi
                      </span>
                    </div>

                    {/* Subtle bottom gradient indicator */}
                    <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${jlpt.color}`} />
                  </Link>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
