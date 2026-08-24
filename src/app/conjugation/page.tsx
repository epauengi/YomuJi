'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowsLeftRight,
  BookOpenText,
  Check,
  Copy,
  MagnifyingGlass,
  SpeakerHigh,
} from '@phosphor-icons/react';
import { mockConjugationData } from '@/data/mockData';
import { Badge } from '@/components/ui/Badge';
import { playJapaneseAudio } from '@/lib/tts';
import { JLPTLevel } from '@/types';

// Helper type for conjugation values
type ConjugationValue = 
  | { plain: string; polite?: string; romaji: { plain: string; polite?: string } }
  | { plain: string; romaji: string }
  | { form: string; romaji: string }
  | string;

type ConjugationKey = 'basic' | 'teForm' | 'past' | 'conditional' | 'volitional' | 'imperative' | 'potential' | 'passive' | 'causative';

// Helper function to extract plain value from conjugation
function getPlainValue(val: ConjugationValue): string {
  if (typeof val === 'string') return val;
  if ('form' in val) return val.form;
  return val.plain;
}

// Helper function to extract romaji from conjugation
function getRomaji(val: ConjugationValue): string {
  if (typeof val === 'string') return '';
  if ('romaji' in val) {
    if (typeof val.romaji === 'string') return val.romaji;
    return val.romaji.plain || '';
  }
  return '';
}

const conjugationLabels: Record<ConjugationKey, { title: string; description: string }> = {
  basic: { title: 'Cơ bản', description: 'Thể thường và lịch sự' },
  teForm: { title: 'Te', description: 'Thể -te' },
  past: { title: 'Quá khứ', description: 'Thể quá khứ' },
  conditional: { title: 'Điều kiện', description: 'Thể điều kiện -ba' },
  volitional: { title: 'Nguyện ý', description: 'Thể muốn làm' },
  imperative: { title: 'Mệnh lệnh', description: 'Thể mệnh lệnh' },
  potential: { title: 'Khả năng', description: 'Thể có thể' },
  passive: { title: 'Bị động', description: 'Thể bị động' },
  causative: { title: 'Khiếu', description: 'Thể khiếu' },
};

export default function ConjugationPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWord, setSelectedWord] = useState<string>('taberu');
  const [activeTab, setActiveTab] = useState<ConjugationKey>('basic');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [showPolite, setShowPolite] = useState(true);

  const currentData = mockConjugationData[selectedWord as keyof typeof mockConjugationData];
  const filteredWords = Object.entries(mockConjugationData).filter(([key, data]) => 
    data.word.includes(searchQuery) || 
    data.reading.includes(searchQuery) ||
    data.romaji.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(type);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const renderConjugationCell = (
    label: string,
    value: string,
    romaji: string,
    type: string,
    showPoliteOption: boolean = false,
    politeValue?: string,
    politeRomaji?: string
  ) => (
    <div className="p-4 bg-[var(--color-surface-subtle)] rounded-xl">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2">
        {label}
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span lang="ja" className="font-ja text-lg">{value}</span>
              <button
                type="button"
                onClick={() => copyToClipboard(value, `${type}-plain`)}
                aria-label={`Sao chép ${value}`}
                className="flex h-11 w-11 items-center justify-center rounded hover:bg-[var(--color-surface)] transition-colors"
              >
                {copiedText === `${type}-plain` ? (
                  <Check className="h-4 w-4 text-[var(--color-success)]" />
                ) : (
                  <Copy className="h-4 w-4 text-[var(--color-text-muted)]" />
                )}
              </button>
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">{romaji}</div>
          </div>
          <button
            type="button"
            onClick={() => playJapaneseAudio(value)}
            title="Nghe phát âm"
            aria-label={`Nghe phát âm ${value}`}
            className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[var(--color-surface)] transition-colors"
          >
            <SpeakerHigh className="h-5 w-5 text-[var(--color-text-muted)]" />
          </button>
        </div>
        
        {showPoliteOption && politeValue && (
          <div className="pt-2 border-t border-[var(--color-border)]">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span lang="ja" className="font-ja text-lg">{politeValue}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(politeValue, `${type}-polite`)}
                    aria-label={`Sao chép ${politeValue}`}
                    className="flex h-11 w-11 items-center justify-center rounded hover:bg-[var(--color-surface)] transition-colors"
                  >
                    {copiedText === `${type}-polite` ? (
                      <Check className="h-4 w-4 text-[var(--color-success)]" />
                    ) : (
                      <Copy className="h-4 w-4 text-[var(--color-text-muted)]" />
                    )}
                  </button>
                </div>
                <div className="text-sm text-[var(--color-text-muted)]">{politeRomaji}</div>
              </div>
              <button
                type="button"
                onClick={() => playJapaneseAudio(politeValue)}
                title="Nghe phát âm"
                aria-label={`Nghe phát âm ${politeValue}`}
                className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[var(--color-surface)] transition-colors"
              >
                <SpeakerHigh className="h-5 w-5 text-[var(--color-text-muted)]" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--color-background)]">
      {/* Header */}
      <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <BookOpenText className="h-6 w-6 text-[var(--color-primary-600)]" />
            <h1 className="text-2xl font-bold">Biến thể</h1>
          </div>
          <p className="text-[var(--color-text-secondary)]">
            Tra cứu và học cách biến đổi động từ, tính từ tiếng Nhật
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Word List Sidebar */}
          <div className="lg:col-span-4">
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden sticky top-20">
              {/* Search */}
              <div className="p-4 border-b border-[var(--color-border)]">
                <div className="relative">
                  <MagnifyingGlass aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    placeholder="Tìm từ..."
                    aria-label="Tìm từ để xem biến thể"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="min-h-11 w-full rounded-[--radius-md] border border-[var(--color-border)] bg-[var(--color-surface-subtle)] py-2 pl-10 pr-4 text-sm focus-visible:border-[var(--color-primary-500)]"
                  />
                </div>
              </div>

              {/* Word List */}
              <div className="max-h-[400px] overflow-y-auto">
                {filteredWords.map(([key, data]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedWord(key)}
                    aria-pressed={selectedWord === key}
                    className={`w-full p-4 text-left border-b border-[var(--color-border)] last:border-b-0 transition-colors ${
                      selectedWord === key 
                        ? 'bg-[var(--color-primary-50)] border-l-4 border-l-[var(--color-primary-600)]' 
                        : 'hover:bg-[var(--color-surface-subtle)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div lang="ja" className="font-ja text-lg font-medium">{data.word}</div>
                        <div lang="ja" className="text-sm text-[var(--color-text-muted)]">{data.reading}</div>
                      </div>
                      <Badge variant="jlpt" jlptLevel={data.jlpt as JLPTLevel} size="sm">
                        {data.jlpt}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {data.type === 'verb' ? 'Động từ' : 'Tính từ'} • {data.romaji}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Conjugation Display */}
          <div className="lg:col-span-8">
            {/* Word Header */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-6 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 lang="ja" className="font-ja text-3xl font-bold">{currentData.word}</h2>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-lg text-[var(--color-text-muted)]">{currentData.reading}</span>
                    <span className="text-lg text-[var(--color-text-muted)]">•</span>
                    <span className="text-lg text-[var(--color-text-muted)]">{currentData.romaji}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="jlpt" jlptLevel={currentData.jlpt as JLPTLevel}>
                    {currentData.jlpt}
                  </Badge>
                  <Badge variant="default">
                    {currentData.type === 'verb' ? 'Động từ' : 'Tính từ'}
                  </Badge>
                  {currentData.type === 'verb' && 'transitive' in currentData && (
                    <Badge variant="default">
                      {currentData.transitive ? 'Ngoại động' : 'Nội động'}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Toggle for Polite forms */}
            <div className="flex items-center gap-4 mb-4">
              <button
                type="button"
                onClick={() => setShowPolite(!showPolite)}
                aria-pressed={showPolite}
                className={`flex min-h-11 items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  showPolite 
                    ? 'bg-[var(--color-action-primary)] text-white' 
                    : 'bg-[var(--color-surface)] border border-[var(--color-border)]'
                }`}
              >
                <ArrowsLeftRight className="h-4 w-4" />
                <span className="text-sm font-medium">Hiện thể lịch sự</span>
              </button>
            </div>

            {/* Conjugation Tabs */}
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl overflow-hidden mb-6">
              <div className="flex overflow-x-auto scrollbar-hide">
                {(Object.keys(conjugationLabels) as ConjugationKey[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    aria-pressed={activeTab === key}
                    className={`flex-shrink-0 min-h-11 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === key
                        ? 'border-[var(--color-primary-600)] text-[var(--color-primary-600)]'
                        : 'border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]'
                    }`}
                  >
                    {conjugationLabels[key].title}
                  </button>
                ))}
              </div>
            </div>

            {/* Conjugation Content */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                {activeTab === 'basic' && currentData.conjugations.basic && (
                  <>
                    <h3 className="text-lg font-semibold">Khẳng định</h3>
                    {renderConjugationCell(
                      'Thường',
                      currentData.conjugations.basic.affirmative.plain,
                      currentData.conjugations.basic.affirmative.romaji.plain,
                      'basic-aff-plain',
                      showPolite,
                      currentData.conjugations.basic.affirmative.polite,
                      currentData.conjugations.basic.affirmative.romaji.polite
                    )}
                    <h3 className="text-lg font-semibold pt-4">Phủ định</h3>
                    {renderConjugationCell(
                      'Thường',
                      currentData.conjugations.basic.negative.plain,
                      currentData.conjugations.basic.negative.romaji.plain,
                      'basic-neg-plain',
                      showPolite,
                      currentData.conjugations.basic.negative.polite,
                      currentData.conjugations.basic.negative.romaji.polite
                    )}
                  </>
                )}

                {activeTab === 'teForm' && currentData.conjugations.teForm && (
                  <>
                    {renderConjugationCell(
                      'Khẳng định',
                      currentData.conjugations.teForm.affirmative.form,
                      currentData.conjugations.teForm.affirmative.romaji,
                      'te-aff'
                    )}
                    {renderConjugationCell(
                      'Phủ định',
                      currentData.conjugations.teForm.negative.form,
                      currentData.conjugations.teForm.negative.romaji,
                      'te-neg'
                    )}
                  </>
                )}

                {activeTab === 'past' && currentData.conjugations.past && (
                  <>
                    <h3 className="text-lg font-semibold">Khẳng định</h3>
                    {renderConjugationCell(
                      'Thường',
                      currentData.conjugations.past.affirmative.plain,
                      currentData.conjugations.past.affirmative.romaji.plain,
                      'past-aff-plain',
                      showPolite,
                      currentData.conjugations.past.affirmative.polite,
                      currentData.conjugations.past.affirmative.romaji.polite
                    )}
                    <h3 className="text-lg font-semibold pt-4">Phủ định</h3>
                    {renderConjugationCell(
                      'Thường',
                      currentData.conjugations.past.negative.plain,
                      currentData.conjugations.past.negative.romaji.plain,
                      'past-neg-plain',
                      showPolite,
                      currentData.conjugations.past.negative.polite,
                      currentData.conjugations.past.negative.romaji.polite
                    )}
                  </>
                )}

                {activeTab === 'conditional' && currentData.conjugations.conditional && (
                  <>
                    {renderConjugationCell(
                      'Khẳng định',
                      currentData.conjugations.conditional.affirmative.plain,
                      currentData.conjugations.conditional.affirmative.romaji,
                      'cond-aff'
                    )}
                    {renderConjugationCell(
                      'Phủ định',
                      currentData.conjugations.conditional.negative.plain,
                      currentData.conjugations.conditional.negative.romaji,
                      'cond-neg'
                    )}
                  </>
                )}

                {activeTab === 'volitional' && currentData.conjugations.volitional && (
                  <>
                    {renderConjugationCell(
                      'Khẳng định',
                      getPlainValue(currentData.conjugations.volitional.affirmative as ConjugationValue),
                      getRomaji(currentData.conjugations.volitional.affirmative as ConjugationValue),
                      'vol-aff'
                    )}
                  </>
                )}

                {activeTab === 'imperative' && currentData.conjugations.imperative && (
                  <>
                    {renderConjugationCell(
                      'Khẳng định',
                      getPlainValue(currentData.conjugations.imperative.affirmative as ConjugationValue),
                      getRomaji(currentData.conjugations.imperative.affirmative as ConjugationValue),
                      'imp-aff'
                    )}
                    {renderConjugationCell(
                      'Phủ định',
                      getPlainValue(currentData.conjugations.imperative.negative as ConjugationValue),
                      getRomaji(currentData.conjugations.imperative.negative as ConjugationValue),
                      'imp-neg'
                    )}
                  </>
                )}

                {activeTab === 'potential' && currentData.conjugations.potential && (
                  <>
                    <h3 className="text-lg font-semibold">Khẳng định</h3>
                    {renderConjugationCell(
                      'Thường',
                      getPlainValue(currentData.conjugations.potential.affirmative as ConjugationValue),
                      getRomaji(currentData.conjugations.potential.affirmative as ConjugationValue),
                      'pot-aff-plain',
                      showPolite,
                      (currentData.conjugations.potential.affirmative as { polite?: string }).polite,
                      getRomaji(currentData.conjugations.potential.affirmative as ConjugationValue)
                    )}
                    <h3 className="text-lg font-semibold pt-4">Phủ định</h3>
                    {renderConjugationCell(
                      'Thường',
                      getPlainValue(currentData.conjugations.potential.negative as ConjugationValue),
                      getRomaji(currentData.conjugations.potential.negative as ConjugationValue),
                      'pot-neg-plain',
                      showPolite,
                      (currentData.conjugations.potential.negative as { polite?: string }).polite,
                      getRomaji(currentData.conjugations.potential.negative as ConjugationValue)
                    )}
                  </>
                )}

                {activeTab === 'passive' && currentData.conjugations.passive && (
                  <>
                    {renderConjugationCell(
                      'Khẳng định',
                      getPlainValue(currentData.conjugations.passive.affirmative as ConjugationValue),
                      getRomaji(currentData.conjugations.passive.affirmative as ConjugationValue),
                      'pass-aff'
                    )}
                    {renderConjugationCell(
                      'Phủ định',
                      getPlainValue(currentData.conjugations.passive.negative as ConjugationValue),
                      getRomaji(currentData.conjugations.passive.negative as ConjugationValue),
                      'pass-neg'
                    )}
                  </>
                )}

                {activeTab === 'causative' && currentData.conjugations.causative && (
                  <>
                    {renderConjugationCell(
                      'Khẳng định',
                      getPlainValue(currentData.conjugations.causative.affirmative as ConjugationValue),
                      getRomaji(currentData.conjugations.causative.affirmative as ConjugationValue),
                      'cau-aff'
                    )}
                    {renderConjugationCell(
                      'Phủ định',
                      getPlainValue(currentData.conjugations.causative.negative as ConjugationValue),
                      getRomaji(currentData.conjugations.causative.negative as ConjugationValue),
                      'cau-neg'
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
