'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GraduationCap } from '@phosphor-icons/react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { useDictionary, getKanjiByLevel } from '@/lib/mockDictionary';
import type { JLPTLevel, KanjiRecord } from '@/types/dictionary';

const LEVELS: JLPTLevel[] = ['N4', 'N3', 'N2', 'N1'];

export default function JLPTPage() {
  const { isReady, progress } = useDictionary();
  const [level, setLevel] = useState<JLPTLevel>('N4');
  const [kanji, setKanji] = useState<KanjiRecord[]>([]);

  useEffect(() => {
    if (!isReady) return;
    getKanjiByLevel(level).then(setKanji);
  }, [isReady, level]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="rounded-2xl bg-[var(--color-primary-50)] p-3 text-[var(--color-primary-600)]">
          <GraduationCap size={32} weight="duotone" />
        </div>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Kanji theo JLPT</h1>
        <p className="max-w-2xl text-[var(--color-text-secondary)]">
          Dữ liệu JLPT hiện lấy từ KANJIDIC cho kanji. Không tự gán cấp độ JLPT cho từ vựng khi chưa có nguồn chuẩn.
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        {LEVELS.map((item) => (
          <button
            key={item}
            onClick={() => setLevel(item)}
            className={`rounded-xl border px-5 py-3 font-semibold transition-colors ${
              level === item
                ? 'border-[var(--color-primary-600)] bg-[var(--color-primary-600)] text-white'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-primary)]'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      {!isReady ? (
        <Card className="py-16 text-center text-[var(--color-text-secondary)]">{progress.message}</Card>
      ) : kanji.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {kanji.map((item) => (
            <Link key={item.literal} href={`/kanji/${encodeURIComponent(item.literal)}`}>
              <Card className="flex h-full flex-col items-center gap-2 text-center hover:border-[var(--color-primary-400)]">
                <span className="jp-text text-4xl font-bold text-[var(--color-text-primary)]">{item.literal}</span>
                {item.jlpt && <Badge variant="jlpt" jlptLevel={item.jlpt} size="sm">{item.jlpt}</Badge>}
                <span className="line-clamp-2 text-xs text-[var(--color-text-secondary)]">
                  {item.hanViet[0] || item.meanings[0] || 'Không rõ'}
                </span>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card className="py-16 text-center text-[var(--color-text-secondary)]">
          Chưa có kanji ở cấp độ {level} trong nguồn hiện tại.
        </Card>
      )}
    </div>
  );
}
