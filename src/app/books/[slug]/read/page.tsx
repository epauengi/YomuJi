'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, BookmarkSimple, Minus, Plus, Sun, Moon, TextAa } from '@phosphor-icons/react';
import { getBook } from '@/data/books';

const STORAGE_KEY = 'yomuji_book_reader_v1';
const demoParagraphs = [
  ['むかし、', '山', 'の近くに', '小さな村', 'がありました。', '朝になると、', '森', 'から風が吹いてきて、', '木々', 'の葉を', '静', 'かにゆらしました。'],
  ['ある日、', 'ひとりの子ども', 'が道を歩いていると、', '小さな声', 'が聞こえました。', '子ども', 'は立ち止まり、声のするほうへ近づいていきました。'],
  ['そこには、', '雨', 'にぬれた', '鳥', 'がいました。', '子ども', 'はそっと手を差し出しました。', '鳥', 'はしばらくその手を見つめ、それから小さく鳴きました。'],
  ['夕方、', '村', 'に帰るころには、', '空', 'がうすい橙色に染まっていました。', '子ども', 'は今日のことを、誰にも話さず胸の中にしまっておきました。'],
];

type ReaderPrefs = { size?: number; dark?: boolean; furigana?: boolean; saved?: boolean };

export default function BookReaderPage() {
  const params = useParams<{ slug: string }>();
  const book = getBook(params.slug);
  const [size, setSize] = useState(23);
  const [dark, setDark] = useState(false);
  const [furigana, setFurigana] = useState(false);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedWord, setSelectedWord] = useState('');
  const bodyRef = useRef<HTMLElement>(null);
  const [supportsSpeech, setSupportsSpeech] = useState(false);

  useEffect(() => {
    setSupportsSpeech(typeof window !== 'undefined' && 'speechSynthesis' in window);
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`${STORAGE_KEY}:${params.slug}`);
      if (!raw) return;
      const prefs = JSON.parse(raw) as ReaderPrefs;
      setSize(Math.min(32, Math.max(18, prefs.size ?? 23)));
      setDark(Boolean(prefs.dark)); setFurigana(Boolean(prefs.furigana)); setSaved(Boolean(prefs.saved));
    } catch { /* Ignore malformed or unavailable local data. */ }
  }, [params.slug]);

  useEffect(() => {
    try { localStorage.setItem(`${STORAGE_KEY}:${params.slug}`, JSON.stringify({ size, dark, furigana, saved })); } catch { /* Reading remains available when storage is disabled. */ }
  }, [dark, furigana, params.slug, saved, size]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const doc = document.documentElement;
        const range = doc.scrollHeight - window.innerHeight;
        setProgress(range > 0 ? Math.min(100, Math.round((window.scrollY / range) * 100)) : 0);
      });
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => { window.removeEventListener('scroll', update); cancelAnimationFrame(frame); };
  }, []);

  if (!book) return <div className="mx-auto max-w-3xl px-4 py-20 text-center"><h1 className="font-serif text-3xl font-semibold">Không tìm thấy truyện</h1><Link className="mt-4 inline-flex min-h-11 items-center text-[var(--color-primary-700)] hover:underline" href="/books">Quay lại thư viện</Link></div>;

  const toggle = (value: boolean, setValue: (next: boolean) => void, label: string) => <button type="button" aria-label={label} aria-pressed={value} onClick={() => setValue(!value)} className="flex h-10 min-w-10 items-center justify-center rounded-full transition hover:bg-[var(--color-primary-100)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-700)]" />;

  return <div data-reader-dark={dark} className="reader-surface min-h-[100dvh] pb-24 transition-colors" style={{ '--reader-size': `${size}px` } as React.CSSProperties}>
    <div className="fixed inset-x-0 top-0 z-20 h-1 bg-[var(--color-border-subtle)]" aria-hidden="true"><div className="h-full bg-[var(--color-primary-600)] transition-[width] duration-150" style={{ width: `${progress}%` }} /></div>
    <header className="sticky top-16 z-10 border-b border-[var(--color-border-subtle)] bg-[var(--reader-bg)]/95 backdrop-blur-sm">
      <div className="mx-auto flex min-h-14 max-w-5xl items-center gap-2 px-3 sm:px-6">
        <Link href={`/books/${book.slug}`} aria-label="Quay lại chi tiết truyện" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-[var(--color-surface-subtle)]"><ArrowLeft size={20} /></Link>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-semibold">{book.title}</p>
        <div className="flex items-center rounded-full bg-[var(--color-surface-subtle)] p-0.5">
          <button type="button" aria-label="Chữ nhỏ hơn" onClick={() => setSize((value) => Math.max(18, value - 1))} disabled={size <= 18} className="flex size-9 items-center justify-center rounded-full disabled:opacity-40"><Minus size={17} /></button>
          <span className="min-w-8 text-center text-xs tabular-nums" aria-live="polite">{size}</span>
          <button type="button" aria-label="Chữ to hơn" onClick={() => setSize((value) => Math.min(32, value + 1))} disabled={size >= 32} className="flex size-9 items-center justify-center rounded-full disabled:opacity-40"><Plus size={17} /></button>
        </div>
        <button type="button" aria-label={saved ? 'Bỏ lưu truyện' : 'Lưu truyện'} aria-pressed={saved} onClick={() => setSaved((value) => !value)} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-[var(--color-primary-100)]"><BookmarkSimple size={19} weight={saved ? 'fill' : 'regular'} /></button>
        <button type="button" aria-label={dark ? 'Bật giao diện sáng' : 'Bật giao diện tối'} aria-pressed={dark} onClick={() => setDark((value) => !value)} className="flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-[var(--color-primary-100)]">{dark ? <Sun size={19} /> : <Moon size={19} />}</button>
        <button type="button" aria-label={furigana ? 'Ẩn Furigana' : 'Hiện Furigana'} aria-pressed={furigana} onClick={() => setFurigana((value) => !value)} className="flex h-10 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold hover:bg-[var(--color-primary-100)] sm:px-3"><TextAa size={17} /> ふ</button>
      </div>
    </header>

    <main ref={bodyRef} className="mx-auto max-w-[calc(var(--reader-size)*34)] px-5 pb-32 pt-12 sm:px-8 sm:pt-16">
      <header className="mb-10 text-center sm:mb-14">
        <h1 lang="ja" className="jp-text font-serif text-3xl font-semibold leading-tight sm:text-5xl">{book.japaneseTitle}</h1>
        <p className="mt-3 text-sm font-medium text-[var(--color-text-secondary)]"><span lang="ja" className="jp-text">{book.author}</span> · {book.romanizedAuthor}</p>
        <p className="mt-1 text-sm italic text-[var(--color-text-muted)]">{book.title}</p>
        <p className="mx-auto mt-5 max-w-lg rounded-lg bg-[var(--color-surface-subtle)] px-4 py-3 text-left text-xs text-[var(--color-text-secondary)]">Bản đọc thử — nội dung minh họa. Tùy chọn được lưu trên thiết bị này.</p>
      </header>
      <article className="reader-copy jp-text space-y-6" lang="ja" aria-label={`Bản đọc thử ${book.title}`}>
        {demoParagraphs.map((segments, index) => <p key={index} className="leading-[1.95]">{segments.map((segment, segmentIndex) => <button key={`${index}-${segmentIndex}`} type="button" onClick={() => setSelectedWord(segment)} className="rounded-sm text-left hover:bg-[color-mix(in_srgb,var(--color-primary-200)_34%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary-700)]">{furigana && segment === '静' ? <ruby>静<rt>しず</rt></ruby> : segment}</button>)}</p>)}
      </article>
      {selectedWord && <aside className="fixed inset-x-4 bottom-24 z-20 mx-auto max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-lg" aria-live="polite">
        <div className="flex items-start justify-between gap-3"><div><p className="jp-text text-lg font-semibold" lang="ja">{selectedWord}</p><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Từ trong bản đọc thử · tra từ vựng qua YomuJi khi có kết quả phù hợp.</p></div><button type="button" onClick={() => setSelectedWord('')} className="min-h-10 px-3 text-sm font-semibold text-[var(--color-primary-700)]">Đóng</button></div>
      </aside>}
      {supportsSpeech && <button type="button" onClick={() => { const utterance = new SpeechSynthesisUtterance(demoParagraphs.flat().join('')); utterance.lang = 'ja-JP'; window.speechSynthesis.cancel(); window.speechSynthesis.speak(utterance); }} className="fixed bottom-24 right-4 z-10 inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-action-primary)] px-4 text-sm font-semibold text-white shadow-md hover:bg-[var(--color-action-primary-hover)] sm:bottom-8 sm:right-8">Nghe thử</button>}
      <div className="mt-12 flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-5 text-xs text-[var(--color-text-muted)]"><span>Đang đọc · {progress}%</span><span>{saved ? 'Đã lưu trên thiết bị' : 'Chưa lưu'}</span></div>
      <Link href={`/books/${book.slug}`} className="mt-8 inline-flex min-h-11 items-center text-sm font-semibold text-[var(--color-primary-700)] hover:underline">Kết thúc bản đọc thử</Link>
    </main>
    <style jsx>{`
      .reader-surface { --reader-bg: var(--color-background); background: var(--reader-bg); color: var(--color-text-primary); }
      .reader-surface[data-reader-dark="true"] { --reader-bg: #17202a; --color-text-primary: #f1f5f9; --color-text-secondary: #cbd5e1; --color-text-muted: #a8b5c4; --color-surface-subtle: #263443; --color-border-subtle: #334155; }
      .reader-copy { font-size: var(--reader-size); }
      .reader-copy ruby rt { font-size: .48em; }
    `}</style>
  </div>;
}
