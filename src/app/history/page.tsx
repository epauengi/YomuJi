'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  BookOpenText,
  Clock,
  ClockCounterClockwise,
  MagnifyingGlass,
  SpeakerHigh,
  Trash,
} from '@phosphor-icons/react';
import { mockSavedWords } from '@/data/mockData';

// Mock search history
const mockSearchHistory = [
  { id: '1', query: '食べる', timestamp: new Date('2024-01-15T10:30:00'), resultCount: 5 },
  { id: '2', query: '飲む', timestamp: new Date('2024-01-15T09:15:00'), resultCount: 3 },
  { id: '3', query: '学校', timestamp: new Date('2024-01-14T18:45:00'), resultCount: 8 },
  { id: '4', query: '友達', timestamp: new Date('2024-01-14T15:20:00'), resultCount: 2 },
  { id: '5', query: '漢字', timestamp: new Date('2024-01-13T20:00:00'), resultCount: 12 },
];

// Mock learning history
type LearningHistoryItem = 
  | { id: string; type: 'word_learned' | 'word_reviewed' | 'word_saved'; word: string; reading: string; meaning: string; timestamp: Date; action: string }
  | { id: string; type: 'deck_studied'; deckName: string; cardCount: number; timestamp: Date; action: string };

const mockLearningHistory: LearningHistoryItem[] = [
  { 
    id: '1', 
    type: 'word_learned',
    word: '日本',
    reading: 'にほん',
    meaning: 'Nhật Bản',
    timestamp: new Date('2024-01-15T10:35:00'),
    action: 'Đã học từ mới'
  },
  { 
    id: '2', 
    type: 'word_reviewed',
    word: '食べる',
    reading: 'たべる',
    meaning: 'ăn',
    timestamp: new Date('2024-01-15T10:30:00'),
    action: 'Ôn tập thành công'
  },
  { 
    id: '3', 
    type: 'word_saved',
    word: '飲む',
    reading: 'のむ',
    meaning: 'uống',
    timestamp: new Date('2024-01-15T09:20:00'),
    action: 'Đã lưu vào danh sách'
  },
  { 
    id: '4', 
    type: 'deck_studied',
    deckName: 'JLPT N5 Core',
    cardCount: 15,
    timestamp: new Date('2024-01-14T20:00:00'),
    action: 'Đã học 15 thẻ'
  },
  { 
    id: '5', 
    type: 'word_learned',
    word: '学校',
    reading: 'がっこう',
    meaning: 'trường học',
    timestamp: new Date('2024-01-14T18:50:00'),
    action: 'Đã học từ mới'
  },
];

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'search' | 'learning'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredHistory = mockLearningHistory.filter(item => {
    if (activeTab === 'search') return false;
    if (activeTab === 'learning') return item.type !== 'deck_studied';
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if ('word' in item) {
        return item.word.toLowerCase().includes(query) || 
               item.meaning.toLowerCase().includes(query);
      }
      if ('deckName' in item) {
        return item.deckName.toLowerCase().includes(query);
      }
    }
    return true;
  });

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} ngày trước`;
    if (hours > 0) return `${hours} giờ trước`;
    return 'Vừa xong';
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'word_learned':
        return <BookOpenText className="h-4 w-4 text-[var(--color-success-600)]" />;
      case 'word_reviewed':
        return <Clock className="h-4 w-4 text-[var(--color-primary-600)]" />;
      case 'word_saved':
        return <SpeakerHigh className="h-4 w-4 text-[var(--color-warning-600)]" />;
      case 'deck_studied':
        return <BookOpenText className="h-4 w-4 text-[var(--color-primary-600)]" />;
      default:
        return <ClockCounterClockwise className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-background)] pb-20">
      {/* Header */}
      <div className="bg-[var(--color-surface)] border-b border-[var(--color-border)]">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <ClockCounterClockwise className="h-6 w-6 text-[var(--color-primary-600)]" />
            <h1 className="text-2xl font-bold">Lịch sử</h1>
          </div>
          <p className="text-[var(--color-text-secondary)]">
            Xem lại hoạt động học tập của bạn
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search */}
        <div className="relative mb-6">
          <MagnifyingGlass className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-muted)]" />
          <input
            type="text"
            placeholder="Tìm kiếm trong lịch sử..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-[--radius-md] border border-[var(--color-border)] bg-[var(--color-surface)] py-3 pl-10 pr-4 text-sm focus-visible:border-[var(--color-primary-500)]"
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'all'
                ? 'bg-[var(--color-primary-600)] text-white'
                : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => setActiveTab('learning')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'learning'
                ? 'bg-[var(--color-primary-600)] text-white'
                : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]'
            }`}
          >
            Học từ
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === 'search'
                ? 'bg-[var(--color-primary-600)] text-white'
                : 'bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]'
            }`}
          >
            Tìm kiếm
          </button>
        </div>

        {/* Search History */}
        {activeTab === 'search' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Lịch sử tìm kiếm</h3>
              <button className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
                Xóa tất cả
              </button>
            </div>
            {mockSearchHistory.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary-300)] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <MagnifyingGlass className="h-4 w-4 text-[var(--color-text-muted)]" />
                  <div>
                    <div className="font-ja font-medium">{item.query}</div>
                    <div className="text-sm text-[var(--color-text-muted)]">
                      {item.resultCount} kết quả • {formatTime(item.timestamp)}
                    </div>
                  </div>
                </div>
                <button className="p-2 rounded-lg hover:bg-[var(--color-surface-subtle)] transition-colors">
                  <Trash className="h-4 w-4 text-[var(--color-text-muted)]" />
                </button>
              </motion.div>
            ))}
          </div>
        )}

        {/* Learning History */}
        {activeTab !== 'search' && (
          <div className="space-y-3">
            {filteredHistory.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                {'word' in item ? (
                  <Link href={`/word/${item.id}`}>
                    <div className="flex items-center gap-4 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl hover:border-[var(--color-primary-300)] transition-colors">
                      <div className="p-2 bg-[var(--color-surface-subtle)] rounded-lg">
                        {getActionIcon(item.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-ja font-medium">{item.word}</span>
                          <span className="text-sm text-[var(--color-text-muted)]">{item.reading}</span>
                        </div>
                        <div className="text-sm text-[var(--color-text-secondary)]">{item.meaning}</div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-1">
                          {item.action} • {formatTime(item.timestamp)}
                        </div>
                      </div>
                    </div>
                  </Link>
                ) : (
                  <div className="flex items-center gap-4 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl">
                    <div className="p-2 bg-[var(--color-surface-subtle)] rounded-lg">
                      {getActionIcon(item.type)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">{'deckName' in item ? item.deckName : ''}</div>
                      <div className="text-sm text-[var(--color-text-secondary)]">
                        {'cardCount' in item ? `Đã học ${item.cardCount} thẻ` : ''}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-1">
                        {item.action} • {formatTime(item.timestamp)}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {filteredHistory.length === 0 && activeTab !== 'search' && (
          <div className="text-center py-12">
            <ClockCounterClockwise className="mx-auto mb-4 h-12 w-12 text-[var(--color-text-muted)]" />
            <p className="text-[var(--color-text-muted)]">Không có hoạt động nào</p>
          </div>
        )}
      </div>
    </div>
  );
}
