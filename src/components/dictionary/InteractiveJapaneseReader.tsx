'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowsClockwise, ArrowSquareOut, BookOpenText, Columns, Rows, SpeakerHigh } from '@phosphor-icons/react';
import { AudioWaveformBars } from '@/components/AudioButton';
import { playJapaneseAudio, stopCurrentAudio } from '@/lib/tts';

type Article = { title: string; extract: string; pageId: number };
type WikiPage = { pageid?: unknown; title?: unknown; extract?: unknown; pageprops?: { disambiguation?: unknown } };

// ponytail: Fetch one small batch per action; cache only if Wikimedia traffic warrants it.
const endpoint = 'https://ja.wikipedia.org/w/api.php?' + new URLSearchParams({
  action: 'query', generator: 'random', grnnamespace: '0', grnlimit: '5',
  prop: 'extracts|pageprops', exintro: '1', explaintext: '1', exchars: '400', exlimit: 'max',
  ppprop: 'disambiguation', format: 'json', formatversion: '2', origin: '*',
});

export async function fetchWikipediaExcerpt(signal: AbortSignal, previousId?: number): Promise<Article> {
  const response = await fetch(endpoint, {
    cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', signal,
    headers: { 'Api-User-Agent': 'YomuJi/1.0 (https://github.com/epauengi/YomuJi)' },
  });
  if (!response.ok) throw new Error('Wikipedia request failed');
  const data = await response.json();
  if (Array.isArray(data?.query?.pages)) {
    for (const page of data.query.pages as (WikiPage | null)[]) {
      if (!page || page.pageprops?.disambiguation !== undefined) continue;
      const { pageid, title, extract } = page;
      const heading = typeof title === 'string' ? title.trim() : '';
      const passage = typeof extract === 'string' ? extract.trim() : '';
      if (typeof pageid !== 'number' || !Number.isSafeInteger(pageid) || pageid <= 0 || pageid === previousId
        || !heading || heading.length > 255 || passage.length < 30 || !/[\u3041-\u30fa]/u.test(passage)) continue;
      // Keep the displayed excerpt and audio within the existing TTS length limit.
      const maxLength = 499 - heading.length;
      return {
        pageId: pageid,
        title: heading,
        extract: passage.length <= maxLength ? passage : passage.slice(0, maxLength - 1).replace(/[\uD800-\uDBFF]$/, '').trimEnd() + '…',
      };
    }
  }
  throw new Error('No Wikipedia excerpt available');
}

export function InteractiveJapaneseReader() {
  const [article, setArticle] = useState<Article | null>(null);
  const [request, setRequest] = useState<{ previousId?: number }>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [isVertical, setIsVertical] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const playing = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetchWikipediaExcerpt(AbortSignal.any([controller.signal, AbortSignal.timeout(8_000)]), request.previousId)
      .then((next) => {
        if (controller.signal.aborted) return;
        setArticle(next);
        setStatus('ready');
      })
      .catch(() => { if (!controller.signal.aborted) setStatus('error'); });
    return () => controller.abort();
  }, [request]);

  useEffect(() => () => {
    if (!playing.current) return;
    playing.current = false;
    stopCurrentAudio();
  }, []);

  const toggleAudio = () => {
    if (!article) return;
    if (playing.current) return stopCurrentAudio();
    playing.current = true;
    setIsPlaying(true);
    const end = () => {
      if (!playing.current) return;
      playing.current = false;
      setIsPlaying(false);
    };
    void playJapaneseAudio(`${article.title}。${article.extract}`, { onEnd: end, onError: end, onCancel: end });
  };

  const isLoading = status === 'loading';
  const canRead = Boolean(article) && !isLoading;

  return (
    <article className="flex h-full min-w-0 flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-7">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-[var(--color-border-subtle)] pb-3">
          <h2 className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary-50)] px-3.5 py-1 text-xs font-extrabold text-[var(--color-primary-700)]">
            <BookOpenText aria-hidden="true" size={15} weight="duotone" />
            Đọc Wikipedia tiếng Nhật
          </h2>
          <button
            type="button"
            onClick={() => setIsVertical((vertical) => !vertical)}
            disabled={!canRead}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] px-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
          >
            {isVertical ? <Rows aria-hidden="true" size={15} /> : <Columns aria-hidden="true" size={15} />}
            {isVertical ? 'Đọc ngang' : 'Đọc dọc'}
          </button>
        </div>

        {isLoading && <p role="status" className={article ? 'sr-only' : 'mt-5 min-h-52 text-sm text-[var(--color-text-secondary)]'}>Đang tải bài đọc…</p>}
        {status === 'error' && (
          <p role="alert" className="mt-4 text-sm text-[var(--color-text-secondary)]">
            {article ? 'Chưa tải được bài khác. Bạn vẫn có thể đọc bài này.' : 'Chưa tải được bài từ Wikipedia. Vui lòng thử lại.'}
          </p>
        )}
        {article && (
          <div className="mt-5" aria-busy={isLoading}>
            <div className="flex items-start justify-between gap-3">
              <h3 lang="ja" className="jp-text min-w-0 self-center text-xl font-extrabold leading-snug [overflow-wrap:anywhere]">{article.title}</h3>
              <button
                type="button"
                onClick={toggleAudio}
                disabled={!canRead}
                aria-label={isPlaying ? 'Dừng phát âm' : 'Nghe bài đọc'}
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] text-[var(--color-primary-700)] hover:border-[var(--color-primary-500)] disabled:opacity-50"
              >
                {isPlaying ? <AudioWaveformBars /> : <SpeakerHigh aria-hidden="true" size={18} weight="duotone" />}
              </button>
            </div>
            <div
              key={`${article.pageId}-${isVertical}`}
              role="region"
              aria-label="Trích đoạn Wikipedia"
              lang="ja"
              tabIndex={0}
              className={`jp-text mt-3 h-52 w-full overflow-auto whitespace-pre-line rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-base leading-loose [overflow-wrap:anywhere] ${isVertical ? '[writing-mode:vertical-rl]' : ''}`}
            >
              {article.extract}
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-3 border-t border-[var(--color-border-subtle)] pt-3 text-xs font-bold">
        <button
          type="button"
          aria-disabled={isLoading}
          onClick={() => {
            if (isLoading) return;
            if (playing.current) stopCurrentAudio();
            setStatus('loading');
            setRequest({ previousId: article?.pageId });
          }}
          className="inline-flex min-h-11 items-center gap-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-primary-700)] aria-disabled:opacity-50"
        >
          <ArrowsClockwise aria-hidden="true" size={14} />
          {status === 'error' ? 'Thử lại' : 'Đọc bài khác'}
        </button>
        {article && (
          <a
            href={`https://ja.wikipedia.org/?curid=${article.pageId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-1 text-[var(--color-link)] hover:text-[var(--color-link-hover)]"
          >
            Đọc trên Wikipedia <ArrowSquareOut aria-hidden="true" size={14} />
          </a>
        )}
        {article && (
          <p className="w-full text-right font-normal text-[var(--color-text-secondary)]">
            Trích đoạn · <a className="inline-flex min-h-11 items-center underline underline-offset-2" href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>
          </p>
        )}
      </div>
    </article>
  );
}
