'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, ShareNetwork, Sparkle } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useDictionary, findKanji, getCompoundsForKanji } from '@/lib/mockDictionary';
import { useKanjiDetail } from '@/hooks/useDictionary';
import { StrokeAnimator } from '@/components/dictionary/StrokeAnimator';
import { KanjiAiExplanationBox } from '@/components/dictionary/KanjiAiExplanationBox';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { toast } from 'sonner';
import type { KanjiRecord, TermRecord } from '@/types/dictionary';
import type { KanjiAiExplanation } from '@/app/api/ai/explain-kanji/route';

function looksVietnamese(text: string) {
  const value = String(text || '').trim();
  if (!value) return false;
  if (/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i.test(value)) {
    return true;
  }

  return /\b(của|là|và|người|được|trong|theo|một|như|với|thứ|dùng|gọi|yêu|thương|buồn|đỏ|lớn|nhỏ|nghĩa)\b/i.test(value);
}

export default function KanjiDetailPage() {
  const params = useParams();
  const router = useRouter();
  const literal = decodeURIComponent(params.slug as string);
  const { kanji, compounds, isLoading, isReady, progress } = useKanjiDetail(literal);
  const [query, setQuery] = useState(literal);

  // AI Explanation State
  const [showAiBox, setShowAiBox] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<KanjiAiExplanation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(literal);
    setShowAiBox(false);
    setAiExplanation(null);
    setAiError(null);
    setAiLoading(false);
  }, [literal]);

  const fetchAiExplanation = async () => {
    if (!kanji) return;
    setShowAiBox(true);

    // Check localStorage cache first
    const cacheKey = `yomuji_ai_kanji_${kanji.literal}`;
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setAiExplanation(JSON.parse(cached));
          setAiLoading(false);
          setAiError(null);
          return;
        }
      } catch (e) {
        console.error('Error reading AI cache:', e);
      }
    }

    setAiLoading(true);
    setAiError(null);

    try {
      const res = await fetch('/api/ai/explain-kanji', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          literal: kanji.literal,
          hanViet: kanji.hanViet,
          meanings: kanji.meanings.filter((meaning) => typeof meaning === 'string' && meaning.length <= 120),
          components: kanji.components,
          onReadings: kanji.onReadings,
          kunReadings: kanji.kunReadings,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to fetch explanation');
      }

      setAiExplanation(data.explanation);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(data.explanation));
        } catch (e) {
          console.error('Error saving AI cache:', e);
        }
      }
    } catch (err: any) {
      setAiError(err.message || 'Có lỗi xảy ra khi yêu cầu giải thích.');
    } finally {
      setAiLoading(false);
    }
  };

  const meanings = useMemo(() => (kanji?.meanings || []).filter(looksVietnamese), [kanji]);
  const primaryMeaning = meanings.slice(0, 3).join(', ');
  const analysisLabel = kanji?.components.length ? kanji.components.join(' + ') : `${literal} (bộ thủ)`;

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const nextQuery = query.trim();
    if (nextQuery) router.push(`/?q=${encodeURIComponent(nextQuery)}`);
  }

  if (!isReady) return <Centered title="Đang chuẩn bị từ điển" message={progress.message} />;
  if (kanji === undefined) return <Centered title="Đang tải Kanji" message="Đang đọc dữ liệu từ IndexedDB..." />;
  if (!kanji) return <Centered title="Không tìm thấy Kanji" message="Kanji này chưa có trong dữ liệu hiện tại." />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 md:py-7">
      <Link href="/" className="mb-4 flex w-fit items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary-700)]">
        <ArrowLeft size={16} />
        Quay lại trang chủ
      </Link>

      <div className="mb-6 text-lg text-[var(--color-text-secondary)]">
        1 kết quả của Hán tự <span className="jp-text font-semibold text-[var(--color-primary-700)]">{kanji.literal}</span>
      </div>

      <div className="content-rise grid grid-cols-1 gap-6 lg:grid-cols-[180px_minmax(0,1fr)_360px] lg:items-start">
        <aside className="lg:pt-1">
          <Link
            href={`/kanji/${encodeURIComponent(kanji.literal)}`}
            className="surface-lift block rounded-[--radius-md] border-2 border-[var(--color-border-strong)] bg-[var(--color-surface)] p-3 hover:border-[var(--color-primary-500)]"
          >
            <div className="jp-text text-xl font-medium text-[var(--color-text-primary)]">{kanji.literal}</div>
            <div className="mt-2 text-lg font-semibold text-[var(--color-text-primary)]">{kanji.hanViet[0] || 'Không rõ'}</div>
            <div className="mt-1 line-clamp-2 text-sm text-[var(--color-text-secondary)]">{primaryMeaning || 'Chưa có nghĩa tiếng Việt'}</div>
          </Link>
        </aside>

        <main className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <motion.h1
                layoutId={`kanji-literal-${kanji.literal}`}
                className="jp-text text-5xl font-medium leading-none text-[var(--color-primary-800)] md:text-6xl"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              >
                {kanji.literal}
              </motion.h1>
              <div className="mt-4 text-3xl font-medium leading-tight text-[var(--color-text-primary)]">
                {kanji.hanViet.join(', ') || 'Không rõ'}
              </div>
            </div>
            <BookmarkButton word={kanji.literal} variant="star" size="lg" title="Lưu Hán tự" />
          </div>

          <div className="mt-6 flex flex-col gap-5">
            <ReadingLine label="On" values={kanji.onReadings} lang="ja" type="on" />
            <ReadingLine label="Kun" values={kanji.kunReadings} lang="ja" type="kun" />

            {kanji.radical && (
              <InfoBlock label="Bộ thủ (Việt)">
                <span className="inline-block rounded-[--radius-md] bg-[var(--color-radical-bg)] px-3 py-1 text-base font-semibold text-[var(--color-radical-text)] border border-[var(--color-radical-border)]">
                  {kanji.radical}
                </span>
              </InfoBlock>
            )}

            {kanji.penStrokes && (
              <InfoBlock label="Thứ tự nét">
                <span className="font-mono text-lg font-medium text-[var(--color-text-secondary)]">
                  {kanji.penStrokes}
                </span>
              </InfoBlock>
            )}

            <InfoBlock label="Ý nghĩa">
              {meanings.length ? (
                <div className="flex flex-wrap gap-x-2 gap-y-1 text-xl font-medium leading-relaxed text-[var(--color-primary-700)]">
                  {meanings.slice(0, 6).map((meaning: string, index: number) => (
                    <span key={`${meaning}-${index}`}>{meaning}{index < Math.min(meanings.length, 6) - 1 ? ',' : ''}</span>
                  ))}
                </div>
              ) : (
                <span className="text-[var(--color-text-secondary)]">Chưa có nghĩa tiếng Việt trong dữ liệu hiện tại.</span>
              )}
            </InfoBlock>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <InfoBlock label="Phổ biến thứ">
                <span className="text-2xl font-medium text-[var(--color-primary-700)]">{kanji.frequency ? kanji.frequency : 'Không rõ'}</span>
              </InfoBlock>
              <InfoBlock label="Số nét">
                <span className="text-2xl font-medium text-[var(--color-primary-700)]">{kanji.strokeCount || kanji.strokePaths.length || 'Không rõ'}</span>
              </InfoBlock>
            </div>

            <InfoBlock label="Ví dụ">
              {compounds.length ? (
                <div className="flex flex-wrap gap-x-2 gap-y-2">
                  {compounds.slice(0, 6).map((term: TermRecord, index: number) => (
                    <Link key={term.id} href={`/word/${encodeURIComponent(term.id)}`} className="group inline-flex flex-col leading-tight">
                      <span className="jp-text text-[11px] text-[var(--color-primary-700)]">{term.reading}</span>
                      <span className="jp-text text-xl font-medium text-[var(--color-primary-700)] group-hover:underline">
                        {term.surface}{index < Math.min(compounds.length, 6) - 1 ? '、' : ''}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <span className="text-[var(--color-text-secondary)]">Chưa tìm thấy từ ghép phổ biến.</span>
              )}
            </InfoBlock>

            <InfoBlock label="Phân tích">
              <span className="text-lg text-[var(--color-text-secondary)]">- </span>
              <span className="jp-text text-xl font-semibold text-[var(--color-text-primary)]">{kanji.literal}</span>
              <span className="ml-1 text-xl font-semibold text-[var(--color-primary-700)]">({analysisLabel})</span>
            </InfoBlock>

            <div className="flex flex-wrap gap-2 pt-2">
              {kanji.jlpt && <Badge variant="jlpt" jlptLevel={kanji.jlpt}>{kanji.jlpt}</Badge>}
              {kanji.grade && <Badge>Lớp {kanji.grade}</Badge>}
              {kanji.unicode && <Badge>U+{kanji.unicode.toUpperCase()}</Badge>}
              {kanji.tags.slice(0, 4).map((tag: string) => <Badge key={tag}>{tag}</Badge>)}
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-3">
              <Button
                variant={showAiBox ? 'primary' : 'secondary'}
                size="sm"
                onClick={fetchAiExplanation}
                disabled={aiLoading}
                className="gap-1.5 shadow-sm"
              >
                <Sparkle size={16} weight="duotone" className="text-amber-500" />
                {aiLoading ? 'Đang giải thích...' : `Giải thích Hán tự ${kanji.literal}`}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && navigator.share) {
                    navigator.share({
                      title: `Chữ Hán: ${kanji.literal} (${kanji.hanViet.join(', ')})`,
                      url: window.location.href,
                    }).catch(() => {});
                  } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(window.location.href);
                    toast.success('Đã sao chép liên kết Hán tự vào bộ nhớ tạm!');
                  }
                }}
              >
                <ShareNetwork size={16} />
                Chia sẻ
              </Button>
            </div>

            {/* AI Explanation Accordion / Box */}
            <AnimatePresence>
              {showAiBox && (
                <div className="pt-2">
                  <KanjiAiExplanationBox
                    literal={kanji.literal}
                    explanation={aiExplanation}
                    isLoading={aiLoading}
                    error={aiError}
                    onClose={() => setShowAiBox(false)}
                    onRetry={fetchAiExplanation}
                  />
                </div>
              )}
            </AnimatePresence>
          </div>
        </main>

        <aside className="lg:sticky lg:top-24">
          <StrokeAnimator
            literal={kanji.literal}
            strokePaths={kanji.strokePaths}
            strokeSvgRaw={kanji.strokeSvgRaw}
            strokeCount={kanji.strokeCount}
          />
        </aside>
      </div>
    </div>
  );
}

function ReadingLine({ label, values, lang, type }: { label: string; values: string[]; lang?: 'ja'; type?: 'on' | 'kun' }) {
  const isOn = type === 'on';
  const badgeStyle = isOn
    ? 'bg-[var(--color-onyomi-bg)] text-[var(--color-onyomi-text)] border-[var(--color-onyomi-border)]'
    : 'bg-[var(--color-kunyomi-bg)] text-[var(--color-kunyomi-text)] border-[var(--color-kunyomi-border)]';

  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-3 items-center">
      <div className="text-2xl font-medium text-[var(--color-text-secondary)]">{label}</div>
      <div className="flex flex-wrap gap-2">
        {values.length ? values.map((value) => (
          <span
            key={value}
            lang={lang}
            className={`jp-text inline-block rounded-[--radius-sm] border px-3 py-1 text-xl font-medium leading-tight ${badgeStyle}`}
          >
            {value}
          </span>
        )) : <span className="text-[var(--color-text-secondary)]">Không có</span>}
      </div>
    </div>
  );
}

function InfoBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-1 text-lg font-medium text-[var(--color-text-secondary)]">{label}</h2>
      <div>{children}</div>
    </section>
  );
}

function Centered({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="mb-3 text-2xl font-semibold text-[var(--color-text-primary)]">{title}</h1>
      <p className="text-[var(--color-text-secondary)]">{message}</p>
    </div>
  );
}
