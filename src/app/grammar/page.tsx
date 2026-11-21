import { Suspense } from 'react';
import type { Metadata } from 'next';
import { getGrammarRepository } from '@/lib/grammar/repository';
import { GRAMMAR_LEVELS, type GrammarLevel } from '@/types/grammar';
import { GrammarExplorer } from '@/components/grammar/GrammarExplorer';

export const metadata: Metadata = {
  title: 'Ngữ pháp JLPT N5–N1',
  description: 'Tra cứu ngữ pháp tiếng Nhật theo cấp độ JLPT N5–N1 kèm cấu trúc kết hợp, sắc thái sử dụng và câu ví dụ có Furigana.',
};

export default async function GrammarPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string; q?: string; tag?: string; selected?: string }>;
}) {
  const params = await searchParams;
  const rawLevel = (params.level || '').toUpperCase();
  const level: GrammarLevel | 'ALL' = (GRAMMAR_LEVELS as readonly string[]).includes(rawLevel)
    ? (rawLevel as GrammarLevel)
    : 'ALL';
  const q = (params.q || '').trim();
  const tag = (params.tag || '').trim();
  const selected = (params.selected || '').trim();

  const initialData = await getGrammarRepository().list({
    level: level === 'ALL' ? undefined : level,
    q: q || undefined,
    tag: tag || undefined,
    limit: 600,
  });

  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl px-4 py-8 text-sm text-[var(--color-text-muted)]">Đang tải danh sách ngữ pháp…</div>}>
      <GrammarExplorer
        initialData={initialData}
        initialLevel={level}
        initialQuery={q}
        initialTag={tag}
        initialSelected={selected}
      />
    </Suspense>
  );
}
