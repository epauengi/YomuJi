'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpenText, LinkSimple, Repeat, Star } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { AudioButton } from '@/components/AudioButton';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useWordDetail } from '@/hooks/useDictionary';

export default function WordDetailPage() {
  const params = useParams();
  const id = decodeURIComponent(params.slug as string);
  const { term, isLoading, isReady, progress } = useWordDetail(id);

  if (!isReady) {
    return <CenteredMessage title="Đang chuẩn bị từ điển" message={progress.message} />;
  }

  if (isLoading) {
    return <CenteredMessage title="Đang tải mục từ" message="Đang đọc dữ liệu từ điển..." />;
  }

  if (!term) {
    return <CenteredMessage title="Không tìm thấy từ vựng" message="Mục từ này không tồn tại trong phiên bản từ điển hiện tại." />;
  }

  const kanjiReadings = term.kanjiReadings || [];
  const audioText = term.reading || term.surface;

  // Extract per-kanji characters from surface for clickable links
  const surfaceKanjiChars: string[] = [];
  for (const ch of term.surface) {
    if (/[\u4e00-\u9faf\u3400-\u4dbf]/.test(ch)) {
      surfaceKanjiChars.push(ch);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <Link href="/" className="flex w-fit items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary-600)]">
        <ArrowLeft size={16} />
        Quay lại trang chủ
      </Link>

      {/* === HEADER CARD === */}
      <Card className="content-rise border-[var(--color-primary-200)] shadow-none">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div className="min-w-0 flex flex-col gap-2">
            {/* Line 1: Surface + Badge */}
            <div className="flex flex-wrap items-center gap-3">
              <motion.h1
                layoutId={`term-surface-${term.id}`}
                className="jp-text text-4xl font-bold text-[var(--color-text-primary)] md:text-5xl"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              >
                {term.surface}
              </motion.h1>
              {term.isCommon && <Badge variant="success">Phổ biến</Badge>}
            </div>

            {/* Line 2: Hán Việt string (uppercase, teal) */}
            {term.hanVietStr && (
              <p className="text-lg font-semibold tracking-wide text-[var(--color-primary-600)]">
                {term.hanVietStr}
              </p>
            )}

            {/* Line 3: Reading hiragana + [romaji] */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="jp-text text-lg font-medium text-[var(--color-text-secondary)]">{term.reading}</span>
              {term.romaji && <span className="text-sm text-[var(--color-text-muted)]">[{term.romaji}]</span>}
            </div>

            {/* Line 4: Audio button + Per-kanji clickable characters */}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <AudioButton text={audioText} />
              {surfaceKanjiChars.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  {surfaceKanjiChars.map((ch, idx) => {
                    // Find per-kanji Hán Việt from kanjiReadings
                    const reading = kanjiReadings.find((r) => r.literal === ch);
                    const hvLabel = reading?.hanViet?.[0] || '';
                    return (
                      <Link
                        key={`${ch}-${idx}`}
                        href={`/kanji/${encodeURIComponent(ch)}`}
                        className="tactile group inline-flex flex-col items-center rounded-[--radius-md] border border-[var(--color-border)] px-2.5 py-1.5 transition-all hover:border-[var(--color-primary-500)] hover:bg-[var(--color-primary-50)]"
                        title={hvLabel ? `${ch} — ${hvLabel}` : ch}
                      >
                        <span className="jp-text text-lg font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary-700)]">
                          {ch}
                        </span>
                        {hvLabel && (
                          <span className="text-[11px] font-medium leading-tight text-[var(--color-primary-600)]">
                            {hvLabel}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <Button variant="secondary" size="sm" className="gap-2">
            <Star size={16} />
            Lưu từ
          </Button>
        </div>
      </Card>

      {/* === CONTENT === */}
      <div className={term.related.length ? 'grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_280px]' : 'grid grid-cols-1 gap-8'}>
        <main className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <BookOpenText size={20} className="text-[var(--color-primary-600)]" />
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Nghĩa của từ</h2>
            </div>
            {term.meaningsVi.length > 0 ? (
              term.meaningsVi.map((meaning, index) => (
                <Card key={`${meaning}-${index}`} variant="subtle" className="surface-lift">
                  <div className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-100)] text-xs font-bold text-[var(--color-primary-700)]">
                      {index + 1}
                    </span>
                    <p className="text-lg text-[var(--color-text-primary)]">{meaning}</p>
                  </div>
                </Card>
              ))
            ) : (
              <p className="text-sm italic text-[var(--color-text-muted)]">Hiện chưa có nghĩa tiếng Việt cho mục từ này.</p>
            )}
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Repeat size={20} className="text-[var(--color-primary-600)]" />
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Ví dụ minh họa</h2>
            </div>
            {term.examples.length ? (
              term.examples.map((example) => (
                <Card key={example.id} className="surface-lift flex flex-col gap-3 shadow-none">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <p className="jp-text text-lg font-medium leading-8 text-[var(--color-text-primary)]">{example.textJa}</p>
                    <AudioButton text={example.textJa} label="Nghe câu" className="shrink-0" />
                  </div>
                  {example.highlight && <p className="jp-text text-sm text-[var(--color-text-muted)]">Từ trong câu: {example.highlight}</p>}
                  <p className="text-[var(--color-text-secondary)]">{example.textVi}</p>
                </Card>
              ))
            ) : (
              <p className="text-sm italic text-[var(--color-text-muted)]">Hiện chưa có ví dụ cho từ này.</p>
            )}
          </section>
        </main>

        {!!term.related.length && (
          <aside className="flex flex-col gap-6">
            <Card className="flex flex-col gap-3 shadow-none">
              <h3 className="flex items-center gap-2 border-b border-[var(--color-border)] pb-2 font-bold">
                <LinkSimple size={16} />
                Liên quan
              </h3>
              {term.related.slice(0, 10).map((related, index) => (
                <span key={`${related.label}-${index}`} className="text-sm text-[var(--color-text-secondary)]">{related.label}</span>
              ))}
            </Card>
          </aside>
        )}
      </div>
    </div>
  );
}



function CenteredMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center">
      <h1 className="mb-3 text-2xl font-bold text-[var(--color-text-primary)]">{title}</h1>
      <p className="mb-8 text-[var(--color-text-secondary)]">{message}</p>
      <Link href="/search">
        <Button variant="primary">Về trang tìm kiếm</Button>
      </Link>
    </div>
  );
}
