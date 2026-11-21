'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { wordHref } from '@/lib/wordRoutes';
import { termBookmark } from '@/lib/browserState';
import type { TermLookupResponse } from '@/types/dictionary';
import Link from 'next/link';
import { BookOpenText, LinkSimple, Repeat } from '@phosphor-icons/react';
import { DictionaryReturnLink } from '@/components/dictionary/DictionaryReturnLink';
import { withSearchOrigin, type SearchOrigin } from '@/lib/dictionary/searchReturn';
import { AudioButton } from '@/components/AudioButton';
import { BookmarkButton } from '@/components/ui/BookmarkButton';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Furigana } from '@/components/ui/Furigana';
import { useWordDetail } from '@/hooks/useDictionary';
import { TatoebaExamples } from './TatoebaExamples';
import { ConjugationTable } from '@/components/dictionary/ConjugationTable';
import {
  getCleanSenseLabels,
  formatSenseRestrictions,
} from '@/lib/dictionary/sensePresenter';

export default function WordDetailPage({ slug, sequence, initial, origin }: {
  slug: string;
  sequence?: string;
  initial?: TermLookupResponse;
  origin?: SearchOrigin;
}) {
  const router = useRouter();
  const { term, alternatives, status, error, retry } = useWordDetail(slug, sequence, initial);
  const canonical = term ? wordHref(term) : null;
  useEffect(() => {
    const current = `/word/${encodeURIComponent(slug)}${sequence ? `?id=${sequence}` : ''}`;
    if (canonical && canonical !== current) router.replace(withSearchOrigin(canonical, origin));
  }, [canonical, slug, sequence, router, origin]);

  if (status === 'loading') {
    return <CenteredMessage origin={origin} title="Đang tải mục từ" message="Đang kiểm tra dữ liệu trực tuyến và dữ liệu dự phòng..." />;
  }

  if (status === 'error') {
    return (
      <CenteredMessage
        title="Chưa thể tải mục từ"
        message={error || 'Không thể đọc dữ liệu từ điển.'}
        actionLabel="Thử lại"
        onAction={retry}
        origin={origin}
      />
    );
  }

  if (alternatives?.length) {
    return (
      <section className="mx-auto max-w-4xl px-4 py-8" aria-labelledby="word-choices-title">
        <DictionaryReturnLink origin={origin} className="mb-3" />
        <h1 id="word-choices-title" className="jp-text text-3xl font-bold">{slug}</h1>
        <p className="mt-3 text-[var(--color-text-secondary)]">Có nhiều mục từ cùng chữ. Chọn cách đọc hoặc nghĩa cần tra.</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {alternatives.map((choice) => (
            <li key={choice.id}>
              <Link href={withSearchOrigin(wordHref(choice), origin)} className="block rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-primary-500)]">
                <span lang="ja" className="jp-text text-xl font-bold">{choice.surface}</span>
                <span lang="ja" className="jp-text ml-3 text-[var(--color-text-secondary)]">{choice.reading}</span>
                <p className="mt-2">{choice.meaningsVi.slice(0, 3).join('; ')}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (!term) {
    return <CenteredMessage title="Không tìm thấy từ vựng" message="Mục từ này không tồn tại trong dữ liệu hiện tại." origin={origin} />;
  }

  const kanjiReadings = term.kanjiReadings || [];
  const audioText = term.reading || term.surface;

  // Alternate written forms
  const alternateWrittenForms = Array.from(
    new Set((term.writtenForms || []).map((f) => f.trim()).filter((f) => Boolean(f) && f !== term.surface))
  );

  // Senses and examples handling
  const hasSenses = Boolean(term.senses && term.senses.length > 0);
  const allSenseExamples = hasSenses
    ? (term.senses || []).flatMap((s) => s.examples || [])
    : [];
  const standaloneExamples = hasSenses
    ? (term.examples || []).filter(
        (ex) => !allSenseExamples.some((sEx) => sEx.textJa.trim() === ex.textJa.trim() || (sEx.id && sEx.id === ex.id))
      )
    : term.examples || [];
  const allLocalExamples = hasSenses
    ? [...allSenseExamples, ...standaloneExamples]
    : term.examples || [];
  const renderStandaloneExample = (example: typeof standaloneExamples[number]) => (
    <Card key={example.id || `${example.textJa}-${example.textVi}`} className="surface-lift flex flex-col gap-3 shadow-none">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p lang="ja" className="jp-text text-base font-medium leading-relaxed text-[var(--color-text-primary)]">{example.textJa}</p>
        <AudioButton text={example.textJa} label="Nghe câu" variant="compact" className="shrink-0" />
      </div>
      {example.highlight && (
        <p className="text-sm text-[var(--color-text-muted)]">
          Từ trong câu: <span lang="ja" className="jp-text">{example.highlight}</span>
        </p>
      )}
      <p className="text-base leading-relaxed text-[var(--color-text-secondary)]">{example.textVi}</p>
    </Card>
  );

  // Extract per-kanji characters from surface for clickable links
  const surfaceKanjiChars: string[] = [];
  for (const ch of term.surface) {
    if (/[\u4e00-\u9faf\u3400-\u4dbf]/.test(ch)) {
      surfaceKanjiChars.push(ch);
    }
  }

  return (
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-8">
      <DictionaryReturnLink origin={origin} />

      <header className="border-b border-[var(--color-border)] pb-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h1 lang="ja" className="jp-text [overflow-wrap:anywhere] text-4xl font-bold tracking-[-0.03em] text-[var(--color-text-primary)] md:text-5xl">
                <Furigana kanji={term.surface} reading={term.reading !== term.surface ? term.reading : ''} />
              </h1>
              {term.isCommon && <Badge variant="success">Phổ biến</Badge>}
            </div>

            <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              {term.hanVietStr && (
                <p className="text-base font-semibold tracking-wide text-[var(--color-primary-600)]">
                  Hán Việt: {term.hanVietStr}
                </p>
              )}
              {term.romaji && <span className="text-sm text-[var(--color-text-muted)]">[{term.romaji}]</span>}
            </div>

            {alternateWrittenForms.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm text-[var(--color-text-secondary)]">
                <span className="text-[var(--color-text-muted)]">Dạng viết khác:</span>
                {alternateWrittenForms.map((form, idx) => (
                  <span key={`${form}-${idx}`} lang="ja" className="jp-text font-medium text-[var(--color-text-primary)]">
                    {form}{idx < alternateWrittenForms.length - 1 ? '、' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div role="group" aria-label="Thao tác mục từ" className="flex shrink-0 items-center gap-2 pt-1">
            <AudioButton text={audioText} variant="icon-only" />
            <BookmarkButton item={termBookmark(term)} size="md" />
          </div>
        </div>

        {surfaceKanjiChars.length > 0 && (
          <div role="group" aria-label="Hán tự trong từ" className="mt-4 flex flex-wrap items-center gap-1.5">
            {surfaceKanjiChars.map((ch, idx) => {
              const reading = kanjiReadings.find((r) => r.literal === ch);
              const hvLabel = reading?.hanViet?.[0] || '';
              return (
                <Link
                  key={`${ch}-${idx}`}
                  href={withSearchOrigin(`/kanji/${encodeURIComponent(ch)}`, origin)}
                  className="tactile group inline-flex min-h-11 min-w-11 flex-col items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] px-2.5 py-1.5 hover:border-[var(--color-primary-500)] hover:bg-[var(--color-primary-50)]"
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
      </header>

      {/* === CONTENT === */}
      <div className={term.related.length ? 'grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_280px]' : 'grid grid-cols-1 gap-8'}>
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <BookOpenText size={20} className="text-[var(--color-primary-600)]" />
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Nghĩa của từ</h2>
            </div>
            {hasSenses ? (
                <ol className="flex flex-col divide-y divide-[var(--color-border)] rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)]">
                {term.senses!.map((sense, index) => {
                  const labels = getCleanSenseLabels(sense.partOfSpeech, sense.misc);
                  const restrictions = formatSenseRestrictions(sense.appliesToKanji, sense.appliesToReadings);
                  return (
                    <li key={`sense-${index}`} className="flex flex-col gap-3 p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-100)] text-xs font-bold text-[var(--color-primary-700)]">
                          {index + 1}
                        </span>
                        {labels.map((label, lIdx) => (
                          <span
                            key={`${label}-${lIdx}`}
                            className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]"
                          >
                            {label}
                          </span>
                        ))}
                        {restrictions.map((restriction, rIdx) => (
                          <span
                            key={`${restriction}-${rIdx}`}
                            className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--color-warning-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-primary)]"
                          >
                            {restriction}
                          </span>
                        ))}
                      </div>

                      {sense.meaningsVi && sense.meaningsVi.length > 0 ? (
                        <ul className="flex flex-col gap-1.5 pl-2 text-[var(--color-text-primary)] sm:pl-8">
                          {sense.meaningsVi.map((meaning, mIdx) => (
                            <li key={mIdx} className="flex items-start gap-2 text-base leading-relaxed">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary-500)]" aria-hidden="true" />
                              <span>{meaning}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="pl-2 text-sm italic text-[var(--color-text-muted)] sm:pl-8">
                          Chưa có nghĩa tiếng Việt.
                        </p>
                      )}

                      {sense.examples && sense.examples.length > 0 && (
                        <div className="mt-2 flex flex-col gap-2.5 pl-2 sm:pl-8">
                          {sense.examples.slice(0, 1).map((example) => (
                            <div
                              key={example.id || `${example.textJa}-${example.textVi}`}
                              className="rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] p-3.5"
                            >
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <p lang="ja" className="jp-text text-base font-medium leading-relaxed text-[var(--color-text-primary)]">
                                  {example.textJa}
                                </p>
                                <AudioButton text={example.textJa} label="Nghe câu" variant="compact" className="shrink-0" />
                              </div>
                              {example.highlight && (
                                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                  Từ trong câu: <span lang="ja" className="jp-text font-medium">{example.highlight}</span>
                                </p>
                              )}
                              <p className="mt-1 text-base leading-relaxed text-[var(--color-text-secondary)]">{example.textVi}</p>
                            </div>
                          ))}
                          {sense.examples.length > 1 && (
                            <details>
                              <summary className="flex min-h-11 cursor-pointer items-center rounded-[var(--radius-sm)] text-sm font-medium text-[var(--color-primary-700)] underline decoration-transparent underline-offset-4 hover:decoration-current">
                                {sense.examples.length - 1} ví dụ khác
                              </summary>
                              <div className="flex flex-col gap-2.5 pt-2">
                                {sense.examples.slice(1).map((example) => (
                                  <div
                                    key={example.id || `${example.textJa}-${example.textVi}`}
                                    className="rounded-[var(--radius-md)] bg-[var(--color-surface-subtle)] p-3.5"
                                  >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                      <p lang="ja" className="jp-text text-base font-medium leading-relaxed text-[var(--color-text-primary)]">
                                        {example.textJa}
                                      </p>
                                      <AudioButton text={example.textJa} label="Nghe câu" variant="compact" className="shrink-0" />
                                    </div>
                                    {example.highlight && (
                                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                        Từ trong câu: <span lang="ja" className="jp-text font-medium">{example.highlight}</span>
                                      </p>
                                    )}
                                    <p className="mt-1 text-base leading-relaxed text-[var(--color-text-secondary)]">{example.textVi}</p>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                {term.partOfSpeech && term.partOfSpeech.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    {getCleanSenseLabels(term.partOfSpeech).map((label, idx) => (
                      <span
                        key={`${label}-${idx}`}
                        className="inline-flex items-center rounded-[var(--radius-sm)] bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}
                {term.meaningsVi && term.meaningsVi.length > 0 ? (
                  <ul className="flex flex-col gap-2 text-[var(--color-text-primary)]">
                    {term.meaningsVi.map((meaning, index) => (
                      <li key={`${meaning}-${index}`} className="flex items-start gap-2.5 text-base leading-relaxed">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-primary-500)]" aria-hidden="true" />
                        <span>{meaning}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm italic text-[var(--color-text-muted)]">Hiện chưa có nghĩa tiếng Việt cho mục từ này.</p>
                )}
              </div>
            )}
          </section>

          <ConjugationTable key={term.id} term={term} />

          <section className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <Repeat size={20} className="text-[var(--color-primary-600)]" />
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Ví dụ minh họa</h2>
            </div>
            {standaloneExamples.slice(0, 1).map(renderStandaloneExample)}
            {standaloneExamples.length > 1 && (
              <details>
                <summary className="flex min-h-11 cursor-pointer items-center rounded-[var(--radius-sm)] text-sm font-medium text-[var(--color-primary-700)] underline decoration-transparent underline-offset-4 hover:decoration-current">
                  {standaloneExamples.length - 1} ví dụ khác
                </summary>
                <div className="flex flex-col gap-3 pt-2">
                  {standaloneExamples.slice(1).map(renderStandaloneExample)}
                </div>
              </details>
            )}
            <TatoebaExamples key={term.id} word={term.surface} localExamples={allLocalExamples} />
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
  origin,
}: {
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  origin?: SearchOrigin;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center" role="status" aria-live="polite">
      <h1 className="mb-3 text-2xl font-bold text-[var(--color-text-primary)]">{title}</h1>
      <p className="mb-8 text-[var(--color-text-secondary)]">{message}</p>
      {onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-action-primary)] px-4 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-action-primary-hover)]"
        >
          {actionLabel || 'Thử lại'}
        </button>
      ) : null}
      <DictionaryReturnLink origin={origin} className={onAction ? 'mx-auto mt-2 flex' : ''} />
    </div>
  );
}
