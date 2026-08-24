'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpenText, LinkSimple, Repeat } from '@phosphor-icons/react';
import { motion } from 'motion/react';
import { AudioButton } from '@/components/AudioButton';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { useWordDetail } from '@/hooks/useDictionary';

export default function WordDetailPage() {
  const params = useParams();
  const id = decodeURIComponent(params.slug as string);
  const { term, status, error, retry } = useWordDetail(id);

  if (status === 'loading') {
    return <CenteredMessage title="Đang tải mục từ" message="Đang kiểm tra dữ liệu trực tuyến và dữ liệu dự phòng..." />;
  }

  if (status === 'error') {
    return (
      <CenteredMessage
        title="Chưa thể tải mục từ"
        message={error || 'Không thể đọc dữ liệu từ điển.'}
        actionLabel="Thử lại"
        onAction={retry}
      />
    );
  }

  if (!term) {
    return <CenteredMessage title="Không tìm thấy từ vựng" message="Mục từ này không tồn tại trong dữ liệu hiện tại." />;
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

      <header className="content-rise border-b border-[var(--color-border)] pb-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
          <div className="min-w-0 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <motion.h1
                layoutId={`term-surface-${term.id}`}
                lang="ja"
                className="jp-text text-4xl font-bold tracking-[-0.03em] text-[var(--color-text-primary)] md:text-5xl"
                transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              >
                {term.surface}
              </motion.h1>
              {term.isCommon && <Badge variant="success">Phổ biến</Badge>}
            </div>

            {term.hanVietStr && (
              <p className="text-lg font-semibold tracking-wide text-[var(--color-primary-600)]">
                {term.hanVietStr}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span lang="ja" className="jp-text text-lg font-medium text-[var(--color-text-secondary)]">{term.reading}</span>
              {term.romaji && <span className="text-sm text-[var(--color-text-muted)]">[{term.romaji}]</span>}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <AudioButton text={audioText} />
              {surfaceKanjiChars.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5" aria-label="Hán tự trong từ">
                  {surfaceKanjiChars.map((ch, idx) => {
                    const reading = kanjiReadings.find((r) => r.literal === ch);
                    const hvLabel = reading?.hanViet?.[0] || '';
                    return (
                      <Link
                        key={`${ch}-${idx}`}
                        href={`/kanji/${encodeURIComponent(ch)}`}
                        className="tactile group inline-flex min-h-11 min-w-11 flex-col items-center justify-center rounded-[--radius-md] border border-[var(--color-border)] px-2.5 py-1.5 hover:border-[var(--color-primary-500)] hover:bg-[var(--color-primary-50)]"
                        title={hvLabel ? `${ch} — ${hvLabel}` : ch}
                      >
                        <span lang="ja" className="jp-text text-lg font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-primary-700)]">
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

          <BookmarkButton word={term.surface} size="lg" />
        </div>
      </header>

      {/* === CONTENT === */}
      <div className={term.related.length ? 'grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_280px]' : 'grid grid-cols-1 gap-8'}>
        <div className="flex flex-col gap-8">
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
                    <p lang="ja" className="jp-text text-lg font-medium leading-8 text-[var(--color-text-primary)]">{example.textJa}</p>
                    <AudioButton text={example.textJa} label="Nghe câu" className="shrink-0" />
                  </div>
                  {example.highlight && <p className="text-sm text-[var(--color-text-muted)]">Từ trong câu: <span lang="ja" className="jp-text">{example.highlight}</span></p>}
                  <p className="text-[var(--color-text-secondary)]">{example.textVi}</p>
                </Card>
              ))
            ) : (
              <p className="text-sm italic text-[var(--color-text-muted)]">Hiện chưa có ví dụ cho từ này.</p>
            )}
          </section>
        </div>

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



function CenteredMessage({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center" role="status" aria-live="polite">
      <h1 className="mb-3 text-2xl font-bold text-[var(--color-text-primary)]">{title}</h1>
      <p className="mb-8 text-[var(--color-text-secondary)]">{message}</p>
      {onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex min-h-11 items-center justify-center rounded-[--radius-md] bg-[var(--color-action-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-primary-hover)]"
        >
          {actionLabel || 'Thử lại'}
        </button>
      ) : (
        <Link
          href="/"
          className="inline-flex min-h-11 items-center justify-center rounded-[--radius-md] bg-[var(--color-action-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-primary-hover)]"
        >
          Về trang tìm kiếm
        </Link>
      )}
    </div>
  );
}
