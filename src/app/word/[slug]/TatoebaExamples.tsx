'use client';

import { useEffect, useState } from 'react';
import { AudioButton } from '@/components/AudioButton';
import { Card } from '@/components/ui/Card';
import type { TatoebaExample } from '@/lib/tatoeba';
import type { ExampleRecord } from '@/types/dictionary';

export function TatoebaExamples({ word, localExamples }: { word: string; localExamples: ExampleRecord[] }) {
  const [examples, setExamples] = useState<TatoebaExample[] | null>(null);
  const [error, setError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError(false);
    setExamples(null);
    fetch(`/api/tatoeba?${new URLSearchParams({ q: word })}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Tatoeba unavailable');
        return response.json();
      })
      .then((data: { examples: TatoebaExample[] }) => {
        if (!controller.signal.aborted) setExamples(data.examples);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [word, attempt]);

  if (error) return <div role="status" className="text-sm text-[var(--color-text-secondary)]">Chưa thể tải ví dụ từ Tatoeba.{' '}<button type="button" onClick={() => setAttempt((value) => value + 1)} className="min-h-11 font-semibold text-[var(--color-primary-700)] underline underline-offset-4">Thử lại</button></div>;
  if (!examples) return <p role="status" className="text-sm text-[var(--color-text-secondary)]">Đang tải ví dụ từ Tatoeba…</p>;
  const additional = examples.filter((example) => !localExamples.some((local) => local.textJa.trim() === example.textJa.trim()));
  if (!additional.length) return localExamples.length ? null : <p className="text-sm text-[var(--color-text-muted)]">Chưa tìm thấy ví dụ Nhật–Việt cho từ này.</p>;

  return <>
    {additional.map((example) => <Card key={example.id} className="surface-lift flex flex-col gap-3 shadow-none">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p lang="ja" className="jp-text text-lg font-medium leading-8 text-[var(--color-text-primary)]">{example.textJa}</p>
        <AudioButton text={example.textJa} label="Nghe câu" className="shrink-0" />
      </div>
      <p className="text-[var(--color-text-secondary)]">{example.textVi}</p>
    </Card>)}
  </>;
}
