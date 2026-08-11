'use client';

import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import {
  ArrowsClockwise,
  BookOpenText,
  Cards,
  CaretRight,
  FileMagnifyingGlass,
  GraduationCap,
  MagnifyingGlass,
  StackSimple,
  Target,
  Translate,
  TrendUp,
} from '@phosphor-icons/react';
import { SearchInput } from '@/components/SearchInput';
import { TermCard } from '@/components/dictionary/TermCard';
import { useDictionary, getPopularTerms, searchDictionary } from '@/lib/mockDictionary';
import type { DictionarySearchResult } from '@/types/dictionary';

const quickLinks = [
  { label: 'Tra từ vựng', detail: 'Kanji, kana, romaji', href: '/search', icon: MagnifyingGlass },
  { label: 'Kanji JLPT', detail: 'Hán Việt và cấp độ', href: '/jlpt', icon: GraduationCap },
  { label: 'Flashcards', detail: 'Lưu từ để ôn lại', href: '/flashcards', icon: Cards },
  { label: 'Ôn tập', detail: 'Nhắc lại theo phiên', href: '/review', icon: ArrowsClockwise },
];

const studyFlow = [
  {
    icon: FileMagnifyingGlass,
    title: 'Tra trong một ô',
    description: 'Nhập kanji, kana, romaji hoặc tiếng Việt. Gợi ý hiện theo đúng dữ liệu từ điển.',
  },
  {
    icon: Translate,
    title: 'Đọc nghĩa theo ngữ cảnh',
    description: 'Nghĩa chính, cách đọc, Hán Việt và ví dụ được đặt gần nhau để giảm đổi màn hình.',
  },
  {
    icon: Target,
    title: 'Giữ lại phần cần học',
    description: 'Từ đã lưu đi tiếp sang flashcards và phiên ôn tập, không làm đứt mạch tra cứu.',
  },
];

const previewRows = [
  { label: 'Từ vựng', value: '食べる', meta: 'たべる - ăn' },
  { label: 'Hán tự', value: '辞', meta: 'Từ điển, lời nói' },
  { label: 'Romaji', value: 'benkyou', meta: '勉強 - học tập' },
];

export default function HomePage() {
  const { isReady, progress } = useDictionary();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DictionarySearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;

    async function run() {
      setLoading(true);
      const next = query.trim()
        ? await searchDictionary(query, 8)
        : await getPopularTerms(8);

      if (!cancelled) {
        setResults(next);
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [isReady, query]);

  return (
    <div className="pb-16">
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] lg:items-center lg:py-10">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-50)] px-3 py-1.5 text-sm font-semibold text-[var(--color-primary-700)]">
              <BookOpenText size={16} weight="duotone" />
              YomuJi Dictionary
            </div>

            <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-[var(--color-text-primary)] text-balance sm:text-5xl lg:text-6xl">
              Tra nhanh, học sâu với YomuJi
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--color-text-secondary)] sm:text-lg">
              Tra từ, kanji, romaji và nghĩa tiếng Việt trong một ô tìm kiếm rõ ràng.
            </p>

            <div className="mt-7 max-w-3xl">
              <SearchInput
                onSearch={setQuery}
                placeholder="Nhập từ cần tra: 日本, 食べる, benkyou, học tập..."
              />
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {quickLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="surface-lift group flex min-h-20 items-center justify-between gap-3 rounded-[--radius-lg] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-left hover:border-[var(--color-primary-300)] hover:bg-[var(--color-surface-subtle)]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius-md] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                        <Icon size={20} weight="duotone" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-[var(--color-text-primary)]">{item.label}</span>
                        <span className="mt-0.5 block truncate text-xs text-[var(--color-text-muted)]">{item.detail}</span>
                      </span>
                    </span>
                    <CaretRight size={16} className="shrink-0 text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-primary-700)]" />
                  </Link>
                );
              })}
            </div>
          </div>

          <HomePreview />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <article className="rounded-[--radius-lg] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="max-w-2xl text-2xl font-extrabold tracking-tight text-[var(--color-text-primary)]">
                  Từ tra cứu sang ghi nhớ trong cùng một nhịp học
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base">
                  Trang chủ ưu tiên tốc độ tra cứu, sau đó mở đường sang kanji, flashcards và ôn tập khi bạn cần học lâu hơn.
                </p>
              </div>
              <Link
                href="/search"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[--radius-md] bg-[var(--color-primary-700)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-800)]"
              >
                Mở trang tìm kiếm
                <CaretRight size={16} weight="bold" />
              </Link>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {studyFlow.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="rounded-[--radius-md] bg-[var(--color-surface-subtle)] p-4">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-[--radius-md] bg-[var(--color-surface)] text-[var(--color-primary-700)]">
                      <Icon size={20} weight="duotone" />
                    </div>
                    <h3 className="font-bold text-[var(--color-text-primary)]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{item.description}</p>
                  </div>
                );
              })}
            </div>
          </article>

          <aside className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-[--radius-lg] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius-md] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                  <StackSimple size={20} weight="duotone" />
                </div>
                <div>
                  <h2 className="font-bold text-[var(--color-text-primary)]">Dữ liệu offline</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    Khi tải xong, dữ liệu nằm trong trình duyệt để tra cứu nhanh hơn và dùng được lúc mạng yếu.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-[--radius-lg] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius-md] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
                  <Translate size={20} weight="duotone" />
                </div>
                <div>
                  <h2 className="font-bold text-[var(--color-text-primary)]">Rõ hai ngôn ngữ</h2>
                  <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">
                    Tiếng Nhật, Hán Việt và tiếng Việt có tầng chữ riêng để dễ đọc trên cả màn hình nhỏ.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 pb-10 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <div className="mb-5 flex items-start gap-3">
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-[--radius-md] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]">
              {query ? <MagnifyingGlass size={20} weight="duotone" /> : <TrendUp size={20} weight="duotone" />}
            </div>
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-[var(--color-text-primary)]">
                {query ? 'Kết quả tra cứu nhanh' : 'Từ phổ biến'}
              </h2>
              <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
                {query ? 'Các mục gần đúng nhất theo từ khóa bạn vừa nhập.' : 'Một số mục thường gặp để bắt đầu tra cứu.'}
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
                Không tìm thấy kết quả phù hợp.
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-[--radius-lg] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
          <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Cách tra nhanh</h2>
          <div className="mt-4 space-y-4 text-sm leading-6 text-[var(--color-text-secondary)]">
            <p>
              Gõ romaji như <span className="font-semibold text-[var(--color-text-primary)]">tabe</span>, tiếng Việt như{' '}
              <span className="font-semibold text-[var(--color-text-primary)]">ăn</span>, hoặc nhập trực tiếp{' '}
              <span className="jp-text font-semibold text-[var(--color-text-primary)]">食べる</span>.
            </p>
            <p>Trong hộp gợi ý, dùng phím mũi tên để chọn từ vựng hoặc Hán tự, rồi nhấn Enter để mở chi tiết.</p>
          </div>
        </aside>
      </section>
    </div>
  );
}

function HomePreview() {
  return (
    <aside className="relative overflow-hidden rounded-[--radius-lg] bg-[#123b36] p-4 text-white shadow-[var(--shadow-md)]">
      <div className="absolute -right-8 -top-10 jp-text text-[11rem] font-black leading-none text-white/10" aria-hidden="true">
        辞
      </div>
      <div className="relative grid gap-3">
        <div className="flex items-center justify-between rounded-[--radius-md] bg-white/10 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-teal-100">YomuJi</p>
            <p className="mt-1 text-xs text-teal-50/80">Bảng tra cứu nhanh</p>
          </div>
          <div className="rounded-full bg-teal-200 px-3 py-1 text-xs font-bold text-[#123b36]">Offline ready</div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[0.9fr_1.1fr] lg:grid-cols-1 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[--radius-md] bg-white p-4 text-[#123b36]">
            <div className="jp-text text-7xl font-bold leading-none">学</div>
            <div className="mt-4 text-sm font-semibold">HỌC</div>
            <p className="mt-2 text-sm leading-6 text-slate-700">Âm On, âm Kun, Hán Việt và ví dụ được gom trong cùng một thẻ.</p>
          </div>

          <div className="grid gap-2">
            {previewRows.map((row) => (
              <div key={row.value} className="rounded-[--radius-md] bg-white/10 p-3">
                <div className="text-xs font-semibold text-teal-100">{row.label}</div>
                <div className="mt-1 jp-text text-xl font-bold">{row.value}</div>
                <div className="mt-1 text-xs text-teal-50/85">{row.meta}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[--radius-md] bg-white/10 p-4">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="font-semibold text-teal-50">Lộ trình tiếp theo</span>
            <span className="text-teal-100">tra - lưu - ôn</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs font-semibold text-teal-50">
            <div className="rounded-[--radius-sm] bg-white/10 px-2 py-2">Từ</div>
            <div className="rounded-[--radius-sm] bg-white/10 px-2 py-2">Kanji</div>
            <div className="rounded-[--radius-sm] bg-white/10 px-2 py-2">SRS</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
