'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlass } from '@phosphor-icons/react';
import { ReaderLookup } from './ReaderLookup';
import { canChunkJapanese, chunkJapanese } from '@/lib/japaneseChunks';

const MAX_LENGTH = 2000;

export function PasteLookup() {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);
  const supported = canChunkJapanese();
  const chunks = useMemo(() => supported ? chunkJapanese(text.slice(0, MAX_LENGTH)) : [], [text, supported]);

  useEffect(() => {
    const capture = () => {
      const selection = window.getSelection();
      const value = selection && !selection.isCollapsed && outputRef.current?.contains(selection.anchorNode) && outputRef.current.contains(selection.focusNode)
        ? selection.toString().normalize('NFKC').replace(/\s+/gu, '').replace(/^\p{P}+|\p{P}+$/gu, '') : '';
      setSelected(value.length <= 80 && /[\p{sc=Han}\p{sc=Hiragana}\p{sc=Katakana}]/u.test(value) ? value : '');
    };
    document.addEventListener('selectionchange', capture);
    return () => document.removeEventListener('selectionchange', capture);
  }, []);

  useEffect(() => {
    if (!query) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && !event.defaultPrevented) setQuery(''); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [query]);

  return (
    <div className="reader-surface mx-auto max-w-3xl px-5 pb-32 pt-10 sm:px-8 sm:pt-14">
      <h1 className="text-3xl font-bold">Dán đoạn để tra</h1>
      <p className="mt-3 text-[var(--color-text-secondary)]">Dán một đoạn tiếng Nhật ngắn, rồi chạm vào từ để xem nghĩa và dạng gốc. Đoạn văn chỉ xử lý trên thiết bị; khi tra, chỉ từ bạn chọn được gửi đi.</p>
      <label className="mt-6 block text-sm font-medium">
        Đoạn tiếng Nhật <span className="text-[var(--color-text-secondary)]">(tối đa {MAX_LENGTH} ký tự)</span>
        <textarea value={text} onChange={(event) => { setText(event.target.value.slice(0, MAX_LENGTH)); setQuery(''); }} maxLength={MAX_LENGTH} rows={5} lang="ja"
          placeholder="例：昨日は忙しくて、ご飯を食べられなかった。"
          className="jp-text mt-1 block w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-lg" />
      </label>
      {!supported ? <p role="alert" className="mt-4 text-sm">Trình duyệt chưa hỗ trợ tách từ tự động. Hãy bôi chọn từ trong đoạn dưới đây để tra.</p> : null}
      {text.trim() && <>
        <p className="mt-6 text-sm text-[var(--color-text-secondary)]">Tách sai? Bôi chọn đúng phần chữ rồi bấm <strong>Tra phần đã chọn</strong>.</p>
        <div ref={outputRef} lang="ja" className="paste-output jp-text mt-2 whitespace-pre-wrap rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] p-4 text-2xl leading-loose">
          {supported ? chunks.map((chunk, index) => chunk.word
            ? <button key={index} type="button" aria-pressed={query === chunk.text} onClick={() => setQuery(chunk.text)} className="paste-chunk">{chunk.text}</button>
            : <span key={index}>{chunk.text}</span>) : text}
        </div>
        {selected && <button type="button" onPointerDown={(event) => event.preventDefault()} onClick={() => setQuery(selected)}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-action-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-action-primary-hover)]">
          <MagnifyingGlass size={16} aria-hidden="true" /> Tra phần đã chọn: <span lang="ja" className="jp-text">{selected}</span>
        </button>}
      </>}
      {query && <ReaderLookup key={query} query={query} onClose={() => setQuery('')} />}
      <style jsx>{`
        .reader-surface :global(.paste-chunk) { border-radius: 4px; padding: 0 1px; text-decoration: underline dotted var(--color-border); text-underline-offset: 6px; }
        .reader-surface :global(.paste-chunk:hover), .reader-surface :global(.paste-chunk[aria-pressed="true"]) { background: var(--color-primary-50); color: var(--color-primary-700); }
        .reader-surface :global(:is(button, textarea, select):focus-visible) { outline: 2px solid var(--color-primary-700); outline-offset: 2px; }
        .reader-surface :global(.reader-lookup) {
          position: fixed; inset: auto 1rem calc(5rem + env(safe-area-inset-bottom)); z-index: 20; max-width: 26rem; max-height: 55dvh;
          margin-inline: auto; border: 1px solid var(--color-border); border-radius: var(--radius-md); background: var(--color-surface); color: var(--color-text-primary);
        }
        @media (min-width: 768px) { .reader-surface :global(.reader-lookup) { inset: auto 2rem 2rem auto; width: min(26rem, calc(100vw - 4rem)); } }
      `}</style>
    </div>
  );
}
