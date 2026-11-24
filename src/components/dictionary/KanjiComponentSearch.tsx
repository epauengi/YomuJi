'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CaretRight, X } from '@phosphor-icons/react';

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

export function filterStrokeGroups<T>(
  groups: ReadonlyArray<[number, T[]]>,
  strokeFilter: number | null,
): Array<[number, T[]]> {
  if (strokeFilter === null) return [...groups];
  return groups.filter(([strokes]) => strokes === strokeFilter);
}

export function getVisibleStrokeComponents<T>(
  groups: ReadonlyArray<[number, T[]]>,
  openStrokes: ReadonlySet<number>,
  strokeFilter: number | null,
): Array<{ strokes: number; parts: T[]; open: boolean }> {
  return filterStrokeGroups(groups, strokeFilter).map(([strokes, parts]) => ({
    strokes,
    parts,
    open: strokeFilter !== null ? true : openStrokes.has(strokes),
  }));
}

export function willPartRemainVisible(
  index: ComponentIndex,
  part: string,
  nextSelected: string[],
  minStrokes: number | null,
  maxStrokes: number | null,
  showAllParts: boolean,
): boolean {
  const entry = index.components.find(([char]) => char === part);
  if (!entry) return false;
  const nextActive = nextSelected.length > 0 || minStrokes !== null || maxStrokes !== null;
  if (!showAllParts && !nextActive && entry[2].length < 15) return false;
  if (!nextActive) return true;
  const { matchedSet } = intersectComponents(index, nextSelected, minStrokes, maxStrokes);
  return entry[2].some((id) => matchedSet.has(id));
}

export function KanjiComponentSearch() {
  const [data, setData] = useState<ComponentIndex | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [minStrokes, setMinStrokes] = useState('');
  const [maxStrokes, setMaxStrokes] = useState('');
  const [showAllParts, setShowAllParts] = useState(false);
  const [partStrokeFilter, setPartStrokeFilter] = useState('all');
  // Open only the 1-stroke group initially (7 buttons) so keyboard users skip straight across stroke disclosures.
  const [openStrokes, setOpenStrokes] = useState<Set<number>>(() => new Set([1]));

  const minStrokesRef = useRef<HTMLInputElement>(null);
  const partStrokeSelectRef = useRef<HTMLSelectElement>(null);
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

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

  // Group components by stroke count; hide parts with 0 matches once filter is active (keep selected visible).
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

  const parsedStrokeFilter = partStrokeFilter === 'all' ? null : Number(partStrokeFilter);
  const strokeFilterNumber =
    parsedStrokeFilter !== null && Number.isFinite(parsedStrokeFilter) ? parsedStrokeFilter : null;

  const visibleGroups = useMemo(
    () => getVisibleStrokeComponents(groups, openStrokes, strokeFilterNumber),
    [groups, openStrokes, strokeFilterNumber],
  );

  const hasMissingSelectedStrokeGroup =
    strokeFilterNumber !== null && !groups.some(([strokes]) => strokes === strokeFilterNumber);

  const toggle = (part: string) => {
    const removing = selected.includes(part);
    const nextSelected = removing
      ? selected.filter((item) => item !== part)
      : [...selected, part];
    setSelected(nextSelected);
    if (
      removing &&
      data &&
      !willPartRemainVisible(data, part, nextSelected, min, max, showAllParts)
    ) {
      partStrokeSelectRef.current?.focus();
    }
  };

  const removeSelected = (part: string) => {
    const idx = selected.indexOf(part);
    const remaining = selected.filter((item) => item !== part);
    setSelected(remaining);
    const nextPart = remaining[Math.min(idx, remaining.length - 1)];
    if (nextPart) {
      chipRefs.current.get(nextPart)?.focus();
    } else {
      partStrokeSelectRef.current?.focus();
    }
  };

  const reset = () => {
    setSelected([]);
    setMinStrokes('');
    setMaxStrokes('');
    setPartStrokeFilter('all');
    minStrokesRef.current?.focus();
  };

  const handleGroupToggle = (strokes: number, isOpen: boolean) => {
    setOpenStrokes((prev) => {
      if (prev.has(strokes) === isOpen) return prev;
      const next = new Set(prev);
      if (isOpen) next.add(strokes);
      else next.delete(strokes);
      return next;
    });
  };

  const renderPartButton = (char: string) => {
    const active = selected.includes(char);
    return (
      <button
        key={char}
        type="button"
        lang="ja"
        aria-pressed={active}
        onClick={() => toggle(char)}
        className={`jp-text inline-flex size-11 items-center justify-center rounded-[var(--radius-sm)] border text-lg focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)] ${active
          ? 'border-[var(--color-action-primary)] bg-[var(--color-action-primary)] font-semibold text-white'
          : 'border-[var(--color-border-subtle)] bg-[var(--color-surface)] hover:border-[var(--color-primary-700)]'}`}
      >
        {char}
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-24 pt-10 sm:px-8 sm:pt-14">
      <h1 className="text-3xl font-bold">Tra Kanji theo thành phần</h1>
      <p className="mt-3 text-[var(--color-text-secondary)]">Chọn một hoặc nhiều thành phần (ví dụ <span lang="ja" className="jp-text font-medium">氵</span> và <span lang="ja" className="jp-text font-medium">青</span> để tìm <span lang="ja" className="jp-text font-medium">清</span>).</p>
      {error && <p role="alert" className="mt-6 text-sm text-[var(--color-error)]">{error}</p>}
      {!data && !error && <p role="status" className="mt-6 text-sm text-[var(--color-text-secondary)]">Đang tải danh sách thành phần…</p>}
      {data && <>
        <div className="mt-6 space-y-3 border-y border-[var(--color-border-subtle)] py-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium">Số nét từ
              <input
                ref={minStrokesRef}
                type="number"
                min={1}
                max={34}
                value={minStrokes}
                onChange={(event) => setMinStrokes(event.target.value)}
                className="mt-1 block min-h-11 w-24 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 tabular-nums focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"
              />
            </label>
            <label className="text-sm font-medium">Đến
              <input
                type="number"
                min={1}
                max={34}
                value={maxStrokes}
                onChange={(event) => setMaxStrokes(event.target.value)}
                className="mt-1 block min-h-11 w-24 rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 tabular-nums focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"
              />
            </label>
            {(selected.length > 0 || minStrokes || maxStrokes || partStrokeFilter !== 'all') && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-11 items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-surface-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"
              >
                <X size={16} aria-hidden="true" /> Xóa bộ lọc
              </button>
            )}
            <span role="status" aria-live="polite" className="ml-auto text-sm tabular-nums text-[var(--color-text-secondary)]">
              {selected.length > 0 && <>Đã chọn: <strong lang="ja" className="jp-text text-[var(--color-text-primary)]">{selected.join(' + ')}</strong> · </>}
              {matched.length ? `${matched.length} Kanji` : selected.length || minStrokes || maxStrokes ? '0 Kanji' : 'Chọn thành phần bên dưới'}
            </span>
          </div>

          {selected.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" aria-label="Thành phần đang chọn">
              {selected.map((part) => (
                <button
                  key={part}
                  ref={(el) => {
                    if (el) chipRefs.current.set(part, el);
                    else chipRefs.current.delete(part);
                  }}
                  type="button"
                  onClick={() => removeSelected(part)}
                  aria-label={`Bỏ chọn thành phần ${part}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[var(--color-action-primary)] px-3 text-sm font-semibold text-white hover:bg-[var(--color-action-primary-hover)] focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"
                >
                  <span lang="ja" className="jp-text">{part}</span>
                  <X size={13} aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </div>

        <section className="mt-6 space-y-3" aria-label="Chọn thành phần Kanji">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold">Thành phần theo số nét</h2>
            <div className="flex w-full flex-wrap items-end gap-2 sm:w-auto">
              <label className="flex w-full flex-col gap-1 text-xs font-medium text-[var(--color-text-secondary)] sm:w-auto">
                Nhóm số nét
                <select
                  ref={partStrokeSelectRef}
                  value={partStrokeFilter}
                  onChange={(event) => setPartStrokeFilter(event.target.value)}
                  aria-label="Lọc thành phần theo số nét"
                  className="min-h-11 w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm tabular-nums text-[var(--color-text-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)] sm:w-auto sm:min-w-44"
                >
                  <option value="all">Tất cả ({groups.length} nhóm nét)</option>
                  {hasMissingSelectedStrokeGroup && (
                    <option value={partStrokeFilter}>{strokeFilterNumber} nét (0)</option>
                  )}
                  {groups.map(([strokes, parts]) => (
                    <option key={strokes} value={String(strokes)}>
                      {strokes} nét ({parts.length})
                    </option>
                  ))}
                </select>
              </label>
              {selected.length === 0 && !minStrokes && !maxStrokes && (
                <button
                  type="button"
                  onClick={() => setShowAllParts((value) => !value)}
                  className="min-h-11 rounded-[var(--radius-sm)] px-2 text-sm font-semibold text-[var(--color-primary-700)] underline focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"
                >
                  {showAllParts ? 'Chỉ hiện thành phần phổ biến' : `Hiện tất cả thành phần (${data.components.length})`}
                </button>
              )}
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">
              Không có thành phần nào khớp bộ lọc hiện tại.
            </p>
          ) : strokeFilterNumber !== null && visibleGroups.length === 0 ? (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-4">
              <p className="text-sm text-[var(--color-text-secondary)]">
                Không có thành phần {strokeFilterNumber} nét khớp bộ lọc hiện tại.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPartStrokeFilter('all');
                  partStrokeSelectRef.current?.focus();
                }}
                className="mt-2 inline-flex min-h-11 items-center rounded-[var(--radius-sm)] border border-[var(--color-border)] px-3 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)] focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"
              >
                Xem tất cả nhóm nét
              </button>
            </div>
          ) : strokeFilterNumber !== null ? (
            visibleGroups.map(({ strokes, parts }) => (
              <div
                key={strokes}
                className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-3"
              >
                <p className="mb-2.5 text-xs font-semibold tabular-nums text-[var(--color-text-secondary)]">
                  {strokes} nét · {parts.length} thành phần
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {parts.map(([char]) => renderPartButton(char))}
                </div>
              </div>
            ))
          ) : (
            <div className="space-y-2">
              {visibleGroups.map(({ strokes, parts, open }) => {
                const selectedInGroup = parts
                  .filter(([char]) => selected.includes(char))
                  .map(([char]) => char);
                const preview = parts.slice(0, 6).map(([char]) => char).join(' ');
                return (
                  <details
                    key={strokes}
                    open={open}
                    onToggle={(event) => handleGroupToggle(strokes, event.currentTarget.open)}
                    className="group rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)]"
                  >
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-sm select-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-action-primary)] [&::-webkit-details-marker]:hidden">
                      <span className="flex min-w-0 items-center gap-2">
                        <CaretRight
                          size={15}
                          aria-hidden="true"
                          className="shrink-0 text-[var(--color-text-muted)] transition-transform motion-reduce:transition-none group-open:rotate-90"
                        />
                        <span className="shrink-0 font-semibold tabular-nums text-[var(--color-text-primary)]">
                          {strokes} nét
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-[var(--color-text-muted)]">
                          ({parts.length})
                        </span>
                        {!open && (
                          <span
                            lang="ja"
                            aria-hidden="true"
                            className="jp-text truncate text-sm text-[var(--color-text-secondary)]"
                          >
                            {preview}
                          </span>
                        )}
                      </span>
                      {selectedInGroup.length > 0 && (
                        <span className="shrink-0 rounded-full bg-[var(--color-primary-50)] px-2 py-0.5 text-xs font-semibold text-[var(--color-primary-700)]">
                          <span className="sr-only">Đã chọn: </span>
                          <span lang="ja" className="jp-text">{selectedInGroup.join(' ')}</span>
                        </span>
                      )}
                    </summary>
                    {open && (
                      <div className="flex flex-wrap gap-1.5 border-t border-[var(--color-border-subtle)] p-3">
                        {parts.map(([char]) => renderPartButton(char))}
                      </div>
                    )}
                  </details>
                );
              })}
            </div>
          )}
        </section>

        {(selected.length > 0 || minStrokes || maxStrokes) && (
          <section className="mt-8" aria-labelledby="kanji-results-heading">
            <h2 id="kanji-results-heading" className="mb-3 text-lg font-semibold">
              Kết quả Kanji{' '}
              <span className="text-sm font-normal tabular-nums text-[var(--color-text-secondary)]">
                ({matched.length})
              </span>
            </h2>
            {matched.length ? (
              <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8">
                {matched.slice(0, 120).map((id) => {
                  const [literal, strokes, hanViet] = data.kanji[id];
                  return (
                    <li key={literal}>
                      <Link
                        href={`/kanji/${encodeURIComponent(literal)}`}
                        className="flex min-h-20 flex-col items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] p-2 text-center hover:border-[var(--color-primary-700)] focus-visible:outline-2 focus-visible:outline-[var(--color-action-primary)]"
                      >
                        <span lang="ja" className="jp-text text-2xl font-medium">{literal}</span>
                        <span className="mt-0.5 max-w-full truncate text-[11px] text-[var(--color-text-secondary)]">{hanViet || `${strokes} nét`}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-[var(--color-text-secondary)]">Không có Kanji nào chứa đủ các thành phần và số nét này.</p>}
            {matched.length > 120 && <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Hiển thị 120 Kanji phổ biến nhất. Chọn thêm thành phần hoặc số nét để thu hẹp.</p>}
          </section>
        )}
      </>}
    </div>
  );
}
