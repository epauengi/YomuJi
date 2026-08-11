'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowCounterClockwise, ArrowLeft, MagnifyingGlass, Pause, Play, SkipBack, SkipForward, Star } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useDictionary, findKanji, getCompoundsForKanji } from '@/lib/mockDictionary';
import type { KanjiRecord, TermRecord } from '@/types/dictionary';

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
  const { isReady, progress } = useDictionary();
  const [query, setQuery] = useState(literal);
  const [kanji, setKanji] = useState<KanjiRecord | null | undefined>(undefined);
  const [compounds, setCompounds] = useState<TermRecord[]>([]);
  const [currentStroke, setCurrentStroke] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setQuery(literal);
  }, [literal]);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    Promise.all([findKanji(literal), getCompoundsForKanji(literal, 12)]).then(([nextKanji, nextCompounds]) => {
      if (!cancelled) {
        setKanji(nextKanji || null);
        setCompounds(nextCompounds);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isReady, literal]);

  const totalStrokes = kanji?.strokePaths.length || 0;

  useEffect(() => {
    if (!isPlaying || !totalStrokes) return;
    const timer = window.setInterval(() => {
      setCurrentStroke((value) => {
        if (value >= totalStrokes) {
          setIsPlaying(false);
          return value;
        }
        return value + 1;
      });
    }, 650);
    return () => window.clearInterval(timer);
  }, [isPlaying, totalStrokes]);

  useEffect(() => {
    setCurrentStroke(0);
    setIsPlaying(false);
  }, [literal]);

  const meanings = useMemo(() => (kanji?.meanings || []).filter(looksVietnamese), [kanji]);
  const primaryMeaning = meanings.slice(0, 3).join(', ');
  const analysisLabel = kanji?.components.length ? kanji.components.join(' + ') : `${literal} (bộ thủ)`;

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const nextQuery = query.trim();
    if (nextQuery) router.push(`/search?q=${encodeURIComponent(nextQuery)}`);
  }

  if (!isReady) return <Centered title="Đang chuẩn bị từ điển" message={progress.message} />;
  if (kanji === undefined) return <Centered title="Đang tải Kanji" message="Đang đọc dữ liệu từ IndexedDB..." />;
  if (!kanji) return <Centered title="Không tìm thấy Kanji" message="Kanji này chưa có trong dữ liệu hiện tại." />;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 md:py-7">
      <form onSubmit={submitSearch} className="search-shell mb-4 flex min-h-12 items-center gap-2 rounded-[--radius-md] border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 shadow-[var(--shadow-xs)]">
        <MagnifyingGlass size={19} className="shrink-0 text-[var(--color-text-muted)]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="jp-text h-11 min-w-0 flex-1 bg-transparent text-xl font-medium text-[var(--color-text-primary)] outline-none placeholder:text-[var(--color-text-muted)]"
          aria-label="Tìm kiếm từ vựng hoặc kanji"
        />
        <Button type="submit" variant="ghost" size="sm">Tìm</Button>
      </form>

      <Link href="/search" className="mb-4 flex w-fit items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-primary-700)]">
        <ArrowLeft size={16} />
        Quay lại tìm kiếm
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
              <h1 className="jp-text text-5xl font-medium leading-none text-[var(--color-primary-800)] md:text-6xl">{kanji.literal}</h1>
              <div className="mt-4 text-3xl font-medium leading-tight text-[var(--color-text-primary)]">
                {kanji.hanViet.join(', ') || 'Không rõ'}
              </div>
            </div>
            <Button variant="ghost" size="sm" aria-label="Lưu kanji">
              <Star size={21} />
            </Button>
          </div>

          <div className="mt-6 flex flex-col gap-5">
            <ReadingLine label="On" values={kanji.onReadings} lang="ja" />
            <ReadingLine label="Kun" values={kanji.kunReadings} lang="ja" />

            <InfoBlock label="Ý nghĩa">
              {meanings.length ? (
                <div className="flex flex-wrap gap-x-2 gap-y-1 text-xl font-medium leading-relaxed text-[var(--color-primary-700)]">
                  {meanings.slice(0, 6).map((meaning, index) => (
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
                <span className="text-2xl font-medium text-[var(--color-primary-700)]">{kanji.strokeCount || totalStrokes || 'Không rõ'}</span>
              </InfoBlock>
            </div>

            <InfoBlock label="Ví dụ">
              {compounds.length ? (
                <div className="flex flex-wrap gap-x-2 gap-y-2">
                  {compounds.slice(0, 6).map((term, index) => (
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
              {kanji.tags.slice(0, 4).map((tag) => <Badge key={tag}>{tag}</Badge>)}
            </div>

            <div className="flex flex-wrap gap-2 pt-3">
              <Button variant="secondary" size="sm">Giải thích Hán tự {kanji.literal}</Button>
              <Button variant="secondary" size="sm">Chia sẻ</Button>
            </div>
          </div>
        </main>

        <aside className="lg:sticky lg:top-24">
          <StrokePanel
            kanji={kanji}
            currentStroke={currentStroke}
            totalStrokes={totalStrokes}
            isPlaying={isPlaying}
            onReset={() => {
              setCurrentStroke(0);
              setIsPlaying(false);
            }}
            onPrev={() => setCurrentStroke((value) => Math.max(0, value - 1))}
            onNext={() => setCurrentStroke((value) => Math.min(totalStrokes, value + 1))}
            onPlayPause={() => {
              if (currentStroke >= totalStrokes) setCurrentStroke(0);
              setIsPlaying((value) => !value);
            }}
          />
        </aside>
      </div>
    </div>
  );
}

function ReadingLine({ label, values, lang }: { label: string; values: string[]; lang?: 'ja' }) {
  return (
    <div className="grid grid-cols-[48px_minmax(0,1fr)] gap-3">
      <div className="text-2xl font-medium text-[var(--color-text-secondary)]">{label}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {values.length ? values.map((value) => (
          <span key={value} lang={lang} className="jp-text text-2xl font-medium leading-tight text-[var(--color-text-primary)]">
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

function StrokePanel({
  kanji,
  currentStroke,
  totalStrokes,
  isPlaying,
  onReset,
  onPrev,
  onNext,
  onPlayPause,
}: {
  kanji: KanjiRecord;
  currentStroke: number;
  totalStrokes: number;
  isPlaying: boolean;
  onReset: () => void;
  onPrev: () => void;
  onNext: () => void;
  onPlayPause: () => void;
}) {
  return (
    <Card padding="sm" className="study-card bg-[var(--color-surface)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" aria-label="Lưu kanji"><Star size={19} /></Button>
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">{currentStroke}/{totalStrokes || kanji.strokeCount || 0}</span>
        <Button variant="ghost" size="sm" aria-label="Vẽ lại" onClick={onReset}><ArrowCounterClockwise size={18} /></Button>
      </div>

      <div className="relative aspect-square w-full overflow-hidden rounded-[--radius-sm] border border-[var(--color-border)] bg-black">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.08)_1px,transparent_1px)] bg-[length:37px_37px]" />
        <div className="absolute left-1/2 top-0 h-full border-l border-white/15" />
        <div className="absolute left-0 top-1/2 w-full border-t border-white/15" />
        {totalStrokes ? (
          <svg viewBox="0 0 109 109" className="absolute inset-0 h-full w-full p-4" aria-label={`Thứ tự nét của chữ ${kanji.literal}`}>
            {kanji.strokePaths.map((stroke, index) => (
              <motion.path
                key={stroke.id}
                d={stroke.d}
                fill="none"
                stroke={index < currentStroke ? strokeColor(index) : index === currentStroke ? '#2DD4BF' : 'rgba(255,255,255,.32)'}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3.4"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: index < currentStroke ? 1 : 0.1 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
              />
            ))}
          </svg>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-sm text-white/70">
            Chưa có dữ liệu thứ tự nét cho Kanji này.
          </div>
        )}
      </div>

      {totalStrokes > 0 && (
        <div className="mt-3 flex items-center justify-center gap-2">
          <Button variant="secondary" size="sm" aria-label="Nét trước" onClick={onPrev} disabled={currentStroke === 0}>
            <SkipBack size={17} />
          </Button>
          <Button variant="primary" size="sm" aria-label={isPlaying ? 'Tạm dừng' : 'Phát thứ tự nét'} onClick={onPlayPause}>
            {isPlaying ? <Pause size={17} /> : <Play size={17} />}
          </Button>
          <Button variant="secondary" size="sm" aria-label="Nét tiếp theo" onClick={onNext} disabled={currentStroke >= totalStrokes}>
            <SkipForward size={17} />
          </Button>
        </div>
      )}
    </Card>
  );
}

function strokeColor(index: number) {
  const colors = ['#5EEAD4', '#2DD4BF', '#14B8A6', '#0D9488', '#115E59'];
  return colors[index % colors.length];
}

function Centered({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="mb-3 text-2xl font-semibold text-[var(--color-text-primary)]">{title}</h1>
      <p className="text-[var(--color-text-secondary)]">{message}</p>
    </div>
  );
}
