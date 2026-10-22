'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BookmarkSimple, Minus, Plus, Sun, Moon, TextAa, SpeakerHigh, Stop } from '@phosphor-icons/react';
import type { Book } from '@/data/books';
import type { BookContent } from '@/lib/bookContent';

const STORAGE_KEY = 'yomuji_book_reader_v1';
type ReaderPrefs = {
  size: number;
  dark: boolean;
  furigana: boolean;
  saved: boolean;
  book?: {
    slug: string;
    title: string;
    japaneseTitle: string;
    author: string;
    romanizedAuthor: string;
    minutes?: number;
    category?: string;
    intro?: string;
    excerpt?: string;
    orthography?: string;
    titleReading?: string;
    credits?: string;
  };
};

export default function BookReader({ book }: { book: Book }) {
  const [prefs, setPrefs] = useState<ReaderPrefs>({ size: 23, dark: false, furigana: false, saved: false });
  const [prefsReady, setPrefsReady] = useState(false);
  const [content, setContent] = useState<BookContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [progress, setProgress] = useState(0);
  const [selectedWord, setSelectedWord] = useState('');
  const [supportsSpeech, setSupportsSpeech] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState('');
  const bodyRef = useRef<HTMLElement>(null);
  const speechRun = useRef(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const { size, dark, furigana, saved } = prefs;

  useEffect(() => {
    setSupportsSpeech('speechSynthesis' in window && 'SpeechSynthesisUtterance' in window);
    let next: ReaderPrefs = { size: 23, dark: document.documentElement.dataset.theme === 'dark', furigana: false, saved: false };
    try {
      const value: unknown = JSON.parse(localStorage.getItem(`${STORAGE_KEY}:${book.slug}`) || 'null');
      if (value && typeof value === 'object') {
        const stored = value as Partial<ReaderPrefs>;
        next = {
          size: typeof stored.size === 'number' && Number.isFinite(stored.size) ? Math.min(32, Math.max(18, stored.size)) : 23,
          dark: typeof stored.dark === 'boolean' ? stored.dark : next.dark,
          furigana: stored.furigana === true,
          saved: stored.saved === true,
        };
      }
    } catch { /* Reading remains available when local data is malformed or blocked. */ }
    setPrefs(next);
    setPrefsReady(true);
  }, [book.slug]);

  useEffect(() => {
    if (!prefsReady) return;
    try {
      const payload: ReaderPrefs = {
        size: prefs.size,
        dark: prefs.dark,
        furigana: prefs.furigana,
        saved: prefs.saved,
      };
      if (prefs.saved) {
        payload.book = {
          slug: book.slug,
          title: book.title,
          japaneseTitle: book.japaneseTitle,
          author: book.author,
          romanizedAuthor: book.romanizedAuthor ?? '',
          ...(book.minutes !== undefined ? { minutes: book.minutes } : {}),
          ...(book.category ? { category: book.category } : {}),
          ...(book.intro ? { intro: book.intro } : {}),
          ...(book.excerpt ? { excerpt: book.excerpt } : {}),
          ...(book.orthography ? { orthography: book.orthography } : {}),
          ...(book.titleReading ? { titleReading: book.titleReading } : {}),
          ...(book.credits ? { credits: book.credits } : {}),
        };
      }
      localStorage.setItem(`${STORAGE_KEY}:${book.slug}`, JSON.stringify(payload));
    } catch { /* Storage is optional. */ }
  }, [book, prefs, prefsReady]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 100000);
    setLoading(true);
    setError('');
    async function load() {
      try {
        const response = await fetch(`/api/books/${encodeURIComponent(book.slug)}/content`, { signal: controller.signal });
        if (!response.ok) throw new Error('Content unavailable');
        const data: BookContent = await response.json();
        if (!Array.isArray(data.paragraphs) || !data.paragraphs.length) throw new Error('Empty content');
        if (active) setContent(data);
      } catch {
        if (active) setError('Chưa tải được nội dung truyện. Kiểm tra kết nối rồi thử lại.');
      } finally {
        window.clearTimeout(timeout);
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [book.slug, attempt]);

  useEffect(() => {
    if (!content) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const body = bodyRef.current;
        if (!body) return;
        const bounds = body.getBoundingClientRect();
        const start = Math.max(0, bounds.top + window.scrollY - 128);
        const end = bounds.bottom + window.scrollY - window.innerHeight;
        setProgress(Math.round(Math.max(0, Math.min(1, (window.scrollY - start) / Math.max(1, end - start))) * 100));
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = new ResizeObserver(update);
    if (bodyRef.current) observer.observe(bodyRef.current);
    update();
    return () => { window.removeEventListener('scroll', update); window.removeEventListener('resize', update); observer.disconnect(); cancelAnimationFrame(frame); };
  }, [content]);

  useEffect(() => () => {
    if (speechRun.current) {
      speechRun.current += 1;
      window.speechSynthesis?.cancel();
    }
    utteranceRef.current = null;
  }, []);

  const paragraphs = useMemo(() => content?.paragraphs.map((paragraph, index) => {
    const segments = paragraph.segments.map((segment, segmentIndex) => segment.reading
      ? <ruby key={segmentIndex}>{segment.text}<rp>（</rp><rt>{segment.reading}</rt><rp>）</rp></ruby>
      : segment.text);
    return paragraph.kind === 'heading'
      ? <h2 key={index} className="pb-2 pt-6 text-center text-xl font-medium">{segments}</h2>
      : <p key={index}>{segments}</p>;
  }), [content]);

  useEffect(() => {
    const captureSelection = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount || !bodyRef.current?.contains(selection.anchorNode) || !bodyRef.current.contains(selection.focusNode)) { setSelectedWord(''); return; }
      const fragment = selection.getRangeAt(0).cloneContents();
      fragment.querySelectorAll('rt, rp').forEach((node) => node.remove());
      const text = fragment.textContent?.trim() || '';
      setSelectedWord(text.length <= 80 ? text : '');
    };
    document.addEventListener('selectionchange', captureSelection);
    return () => document.removeEventListener('selectionchange', captureSelection);
  }, []);

  const readAloud = () => {
    const id = ++speechRun.current;
    window.speechSynthesis.cancel();
    utteranceRef.current = null;
    setSpeechError('');
    if (speaking || !content) { setSpeaking(false); return; }
    const chunks = content.paragraphs.flatMap((paragraph) => paragraph.segments.map((segment) => segment.text).join('').match(/.{1,180}/gu) || []);
    setSpeaking(true);
    const next = (index: number) => {
      if (speechRun.current !== id) return;
      if (index >= chunks.length) { setSpeaking(false); utteranceRef.current = null; return; }
      const utterance = new SpeechSynthesisUtterance(chunks[index]);
      utteranceRef.current = utterance;
      utterance.lang = 'ja-JP';
      const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith('ja'));
      if (voice) utterance.voice = voice;
      const fail = () => {
        if (speechRun.current !== id) return;
        setSpeaking(false);
        utteranceRef.current = null;
        setSpeechError('Không thể phát giọng đọc. Thử lại hoặc kiểm tra giọng tiếng Nhật trên thiết bị.');
      };
      utterance.onend = () => next(index + 1);
      utterance.onerror = fail;
      try { window.speechSynthesis.speak(utterance); } catch { fail(); }
    };
    next(0);
  };

  return <div data-reader-dark={dark} className="reader-surface min-h-[100dvh] pb-24" style={{ '--reader-size': `${size}px` } as React.CSSProperties}>
    <div className="fixed inset-x-0 top-0 z-20 h-1 bg-[var(--color-border-subtle)]" aria-hidden="true"><div className="h-full bg-[var(--color-primary-600)] motion-safe:transition-[width] motion-safe:duration-150" style={{ width: `${progress}%` }} /></div>
    <header className="sticky top-16 z-10 border-b border-[var(--color-border-subtle)] bg-[var(--reader-bg)]">
      <div className="mx-auto flex min-h-14 max-w-5xl items-center px-1 min-[360px]:gap-1 min-[360px]:px-2 sm:gap-2 sm:px-6">
        <Link href={`/books/${book.slug}`} aria-label="Quay lại chi tiết truyện" className="inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-[var(--color-surface-subtle)]"><ArrowLeft aria-hidden="true" size={20} /></Link>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold">{book.title}</p>
        <div className="flex shrink-0 items-center rounded-full bg-[var(--color-surface-subtle)] p-0.5">
          <button type="button" aria-label="Chữ nhỏ hơn" onClick={() => setPrefs((value) => ({ ...value, size: Math.max(18, value.size - 1) }))} disabled={!prefsReady || size <= 18} className="flex size-11 items-center justify-center rounded-full disabled:opacity-40"><Minus aria-hidden="true" size={17} /></button>
          <span className="min-w-6 text-center text-xs tabular-nums" aria-live="polite">{size}</span>
          <button type="button" aria-label="Chữ to hơn" onClick={() => setPrefs((value) => ({ ...value, size: Math.min(32, value.size + 1) }))} disabled={!prefsReady || size >= 32} className="flex size-11 items-center justify-center rounded-full disabled:opacity-40"><Plus aria-hidden="true" size={17} /></button>
        </div>
        <button type="button" disabled={!prefsReady} aria-label={saved ? 'Bỏ lưu truyện' : 'Lưu truyện'} aria-pressed={saved} onClick={() => setPrefs((value) => ({ ...value, saved: !value.saved }))} className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-[var(--color-surface-subtle)] disabled:opacity-40"><BookmarkSimple aria-hidden="true" size={19} weight={saved ? 'fill' : 'regular'} /></button>
        <button type="button" disabled={!prefsReady} aria-label={dark ? 'Bật giao diện sáng' : 'Bật giao diện tối'} aria-pressed={dark} onClick={() => setPrefs((value) => ({ ...value, dark: !value.dark }))} className="flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-[var(--color-surface-subtle)] disabled:opacity-40">{dark ? <Sun aria-hidden="true" size={19} /> : <Moon aria-hidden="true" size={19} />}</button>
        <button type="button" disabled={!prefsReady} aria-label={furigana ? 'Ẩn Furigana' : 'Hiện Furigana'} aria-pressed={furigana} onClick={() => setPrefs((value) => ({ ...value, furigana: !value.furigana }))} className="flex size-11 shrink-0 items-center justify-center rounded-full text-xs font-semibold hover:bg-[var(--color-surface-subtle)] disabled:opacity-40"><TextAa aria-hidden="true" size={21} /></button>
      </div>
    </header>

    <main className="mx-auto max-w-[calc(var(--reader-size)*34)] px-5 pb-24 pt-10 sm:px-8 sm:pt-16">
      <header className="mb-10 text-center sm:mb-14">
        <h1 lang="ja" className="jp-text font-serif text-3xl font-semibold leading-tight sm:text-5xl">{book.japaneseTitle}</h1>
        <p className="mt-3 text-sm font-medium text-[var(--color-text-secondary)]"><span lang="ja" className="jp-text">{book.author}</span>{book.romanizedAuthor ? ` · ${book.romanizedAuthor}` : ''}</p>
        {book.credits && <p lang="ja" className="jp-text mt-2 text-sm text-[var(--color-text-secondary)]">{book.credits}</p>}
        {book.title !== book.japaneseTitle && <p className="mt-1 text-sm italic text-[var(--color-text-muted)]">{book.title}</p>}
        <p className="mt-6 text-sm text-[var(--color-text-muted)]">Chọn một từ hoặc cụm từ để tra nghĩa.</p>
      </header>
      {loading ? <div role="status" className="space-y-5 py-4"><p className="text-sm text-[var(--color-text-secondary)]">Đang tải nội dung truyện… Tác phẩm dài có thể cần khoảng một phút.</p><div aria-hidden="true" className="space-y-5">{[100, 92, 96, 72].map((width) => <div key={width} className="h-4 rounded-sm bg-[var(--color-surface-subtle)]" style={{ width: `${width}%` }} />)}</div></div>
        : error ? <div role="alert" className="border-y border-[var(--color-border-subtle)] py-8"><h2 className="font-serif text-2xl font-semibold">Nội dung chưa sẵn sàng</h2><p className="mt-3 text-sm text-[var(--color-text-secondary)]">{error}</p><button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-5 inline-flex min-h-11 items-center rounded-full bg-[var(--color-action-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--color-action-primary-hover)]">Thử lại</button></div>
          : <article ref={bodyRef} data-furigana={furigana} className="reader-copy jp-text space-y-5" lang="ja" aria-label={book.japaneseTitle}>{paragraphs}</article>}
      {selectedWord && <aside className="fixed inset-x-4 bottom-24 z-20 mx-auto max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4" aria-live="polite" aria-label="Tra từ đã chọn" onKeyDown={(event) => { if (event.key === 'Escape') setSelectedWord(''); }}>
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="jp-text break-words text-lg font-semibold" lang="ja">{selectedWord}</p><Link href={`/?q=${encodeURIComponent(selectedWord)}`} className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-primary-700)] hover:underline">Tra trong từ điển</Link></div><button type="button" onClick={() => setSelectedWord('')} className="min-h-11 px-3 text-sm font-semibold text-[var(--color-text-secondary)] hover:underline">Đóng</button></div>
      </aside>}
      {supportsSpeech && content && !error && !loading && !selectedWord && <button type="button" aria-pressed={speaking} onClick={readAloud} className="fixed bottom-24 right-4 z-10 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-action-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-action-primary-hover)] sm:bottom-8 sm:right-8">{speaking ? <Stop aria-hidden="true" size={18} /> : <SpeakerHigh aria-hidden="true" size={18} />}{speaking ? 'Dừng đọc' : 'Nghe truyện'}</button>}
      {speechError && <p role="alert" className="mt-6 text-sm text-[var(--color-text-secondary)]">{speechError}</p>}
      <div className="mt-12 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-5 text-xs text-[var(--color-text-muted)]"><span>{content && !error ? `Đang đọc · ${progress}%` : 'Nguyên tác tiếng Nhật'}</span><span>{saved ? 'Đã lưu trên thiết bị' : 'Chưa lưu'}</span></div>
      <Link href={`/books/${book.slug}`} className="mt-6 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-primary-700)] hover:underline">Quay lại chi tiết truyện</Link>
    </main>
    <style jsx>{`
      .reader-surface { --reader-bg: #f6f8fa; --color-text-primary: #17202a; --color-text-secondary: #475569; --color-text-muted: #586a7e; --color-surface: #fff; --color-surface-subtle: #e9eef3; --color-border: #d7e0e8; --color-border-subtle: #d7e0e8; --color-primary-700: #0f766e; --color-action-primary: #0f766e; --color-action-primary-hover: #115e59; color-scheme: light; background: var(--reader-bg); color: var(--color-text-primary); }
      .reader-surface[data-reader-dark="true"] { --reader-bg: #111a23; --color-text-primary: #eef3f7; --color-text-secondary: #cbd5e1; --color-text-muted: #a8b5c4; --color-surface: #17232f; --color-surface-subtle: #263443; --color-border: #3e5060; --color-border-subtle: #334155; --color-primary-700: #5eead4; color-scheme: dark; }
      .reader-surface :is(button, a):focus-visible { outline: 2px solid var(--color-primary-700); outline-offset: 3px; }
      .reader-copy { font-size: var(--reader-size); line-height: 2.15; font-weight: 400; overflow-wrap: anywhere; white-space: pre-wrap; }
      .reader-copy ::selection { background: #99f6e4; color: #17202a; }
      .reader-copy :global(ruby rt) { font-size: .48em; }
      .reader-copy[data-furigana="false"] :global(rt), .reader-copy :global(rp) { display: none; }
    `}</style>
  </div>;
}
