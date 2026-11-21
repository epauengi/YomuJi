'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { X } from '@phosphor-icons/react';

type ComponentIndex = {
  coverage: { totalDictKanji: number; indexedKanji: number; withComponents: number };
  kanji: Array<[literal: string, strokes: number, hanViet: string]>;
  components: Array<[char: string, strokes: number, kanjiIds: number[]]>;
};

export function intersectComponents(
  index: ComponentIndex,
  selected: string[],
  minStrokes: number | null,
  maxStrokes: number | null,
) {
  const byChar = new Map(index.components.map((entry) => [entry[0], entry[2]]));
  let ids: number[] | null = null;
  for (const part of selected) {
    const list = byChar.get(part) ?? [];
    if (ids === null) ids = list;
    else {
      const allowed = new Set(list);
      ids = ids.filter((id) => allowed.has(id));
    }
  }
  const pool = ids ?? (minStrokes !== null || maxStrokes !== null ? index.kanji.map((_, i) => i) : []);
  const matched = pool.filter((id) => {
    const strokes = index.kanji[id]?.[1] ?? 0;
    return (minStrokes === null || strokes >= minStrokes) && (maxStrokes === null || strokes <= maxStrokes);
  });
  const matchedSet = new Set(matched);
  return { matched, matchedSet };
}

export function KanjiComponentSearch() {
  const [data, setData] = useState<ComponentIndex | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [minStrokes, setMinStrokes] = useState('');
  const [maxStrokes, setMaxStrokes] = useState('');
  const [showAllParts, setShowAllParts] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/dict/meta/kanji-components.json', { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
      .then((payload: ComponentIndex) => setData(payload))
      .catch(() => { if (!controller.signal.aborted) setError('Không tải được chỉ mục thành phần Kanji.'); });
    return () => controller.abort();
  }, []);

  const min = minStrokes ? Number(minStrokes) : null;
  const max = maxStrokes ? Number(maxStrokes) : null;

  const { matched, matchedSet } = useMemo(
    () => data ? intersectComponents(data, selected, min, max) : { matched: [], matchedSet: new Set<number>() },
    [data, selected, min, max],
  );

  // Group components by stroke count; hide parts with 0 matches once a filter is active (keep selected visible).
  const groups = useMemo(() => {
    if (!data) return [];
    const active = selected.length > 0 || min !== null || max !== null;
    const map = new Map<number, Array<[string, number, number[]]>>();
    for (const entry of data.components) {
      if (!showAllParts && !active && entry[2].length < 15) continue;
      const relevant = !active || selected.includes(entry[0]) || entry[2].some((id) => matchedSet.has(id));
      if (!relevant) continue;
      const list = map.get(entry[1]) ?? [];
      list.push(entry);
      map.set(entry[1], list);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [data, selected, min, max, matchedSet, showAllParts]);

  const toggle = (part: string) => setSelected((prev) => prev.includes(part) ? prev.filter((item) => item !== part) : [...prev, part]);
  const reset = () => { setSelected([]); setMinStrokes(''); setMaxStrokes(''); };

  return (
    <div className="mx-auto max-w-4xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
      <h1 className="text-3xl font-bold">Tra Kanji theo thành phần</h1>
      <p className="mt-3 text-[var(--color-text-secondary)]">Chọn một hoặc nhiều thành phần (ví dụ <span lang="ja" className="jp-text font-medium">氵</span> và <span lang="ja" className="jp-text font-medium">青</span> để tìm <span lang="ja" className="jp-text font-medium">清</span>). Dữ liệu phân tách từ KanjiVG (không phải mọi thành phần đều là bộ thủ chính).</p>
      {error && <p role="alert" className="mt-6 text-sm text-[var(--color-danger)]">{error}</p>}
      {!data && !error && <p role="status" className="mt-6 text-sm text-[var(--color-text-secondary)]">Đang tải danh sách thành phần…</p>}
      {data && <>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Độ phủ hiện tại: {data.coverage.withComponents.toLocaleString('vi-VN')} / {data.coverage.totalDictKanji.toLocaleString('vi-VN')} Kanji trong từ điển có dữ liệu thành phần KanjiVG.</p>
        <div className="mt-6 flex flex-wrap items-end gap-3 border-y border-[var(--color-border-subtle)] py-4">
          <label className="text-sm font-medium">Số nét từ
            <input type="number" min={1} max={34} value={minStrokes} onChange={(event) => setMinStrokes(event.target.value)}
              className="mt-1 block min-h-11 w-24 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 tabular-nums" />
          </label>
          <label className="text-sm font-medium">Đến
            <input type="number" min={1} max={34} value={maxStrokes} onChange={(event) => setMaxStrokes(event.target.value)}
              className="mt-1 block min-h-11 w-24 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 tabular-nums" />
          </label>
          {(selected.length > 0 || minStrokes || maxStrokes) && (
            <button type="button" onClick={reset}
              className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-surface-subtle)]">
              <X size={16} aria-hidden="true" /> Xóa bộ lọc
            </button>
          )}
          <span className="ml-auto text-sm text-[var(--color-text-secondary)]">
            {selected.length > 0 && <>Đã chọn: <strong lang="ja" className="jp-text text-[var(--color-text-primary)]">{selected.join(' + ')}</strong> · </>}
            {matched.length ? `${matched.length} Kanji` : selected.length || minStrokes || maxStrokes ? '0 Kanji' : 'Chọn thành phần bên dưới'}
          </span>
        </div>

        {(selected.length > 0 || minStrokes || maxStrokes) && (
          <section className="mt-6" aria-label="Kết quả Kanji">
            {matched.length ? (
              <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {matched.slice(0, 120).map((id) => {
                  const [literal, strokes, hanViet] = data.kanji[id];
                  return (
                    <li key={literal}>
                      <Link href={`/kanji/${encodeURIComponent(literal)}`}
                        className="flex min-h-20 flex-col items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-2 text-center hover:border-[var(--color-primary-700)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary-700)]">
                        <span lang="ja" className="jp-text text-2xl font-medium">{literal}</span>
                        <span className="mt-0.5 max-w-full truncate text-[11px] text-[var(--color-text-secondary)]">{hanViet || `${strokes} nét`}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-[var(--color-text-secondary)]">Không có Kanji nào chứa đủ các thành phần và số nét đã chọn.</p>}
            {matched.length > 120 && <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Hiển thị 120 Kanji phổ biến nhất. Hãy chọn thêm thành phần hoặc số nét để thu hẹp.</p>}
          </section>
        )}

        <section className="mt-8 space-y-4" aria-label="Chọn thành phần theo số nét">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Thành phần theo số nét</h2>
            {selected.length === 0 && !minStrokes && !maxStrokes && (
              <button type="button" onClick={() => setShowAllParts((value) => !value)}
                className="min-h-11 text-sm font-semibold text-[var(--color-primary-700)] hover:underline">
                {showAllParts ? 'Chỉ hiện thành phần hay gặp' : `Hiện tất cả (${data.components.length})`}
              </button>
            )}
          </div>
          {groups.map(([strokes, parts]) => (
            <div key={strokes} className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex min-w-12 justify-center rounded bg-[var(--color-surface-subtle)] px-2 py-1 text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">{strokes} nét</span>
              {parts.map(([char]) => {
                const active = selected.includes(char);
                return (
                  <button key={char} type="button" lang="ja" aria-pressed={active} onClick={() => toggle(char)}
                    className={`jp-text inline-flex size-11 items-center justify-center rounded-[var(--radius-sm)] border text-lg focus-visible:outline-2 focus-visible:outline-[var(--color-primary-700)] ${active
                      ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)] font-semibold text-white'
                      : 'border-[var(--color-border-subtle)] bg-[var(--color-surface)] hover:border-[var(--color-primary-700)]'}`}>
                    {char}
                  </button>
                );
              })}
            </div>
          ))}
        </section>
      </>}
    </div>
  );
}
