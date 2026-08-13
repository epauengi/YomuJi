'use client';

import { useEffect, useState } from 'react';
import {
  useDictionary,
  searchDictionary,
  searchKanjiDictionary,
  findTerm,
  findKanji,
  getCompoundsForKanji,
} from '@/lib/mockDictionary';
import type { TermRecord, KanjiRecord, DictionarySearchResult, KanjiDictionarySearchResult } from '@/types/dictionary';

/**
 * Custom hook to handle searching terms and kanji with debounce
 */
export function useSearch(query: string, limit = 10) {
  const { isReady } = useDictionary();
  const [termResults, setTermResults] = useState<DictionarySearchResult[]>([]);
  const [kanjiResults, setKanjiResults] = useState<KanjiDictionarySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!isReady || trimmed.length < 1) {
      setTermResults([]);
      setKanjiResults([]);
      setIsSearching(false);
      return;
    }

    let isCancelled = false;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const [terms, kanji] = await Promise.all([
          searchDictionary(trimmed, limit),
          searchKanjiDictionary(trimmed, 6),
        ]);
        if (!isCancelled) {
          setTermResults(terms);
          setKanjiResults(kanji);
        }
      } catch (err) {
        console.error('Error executing search:', err);
      } finally {
        if (!isCancelled) setIsSearching(false);
      }
    }, 150);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [query, isReady, limit]);

  return { termResults, kanjiResults, isSearching, isReady };
}

/**
 * Custom hook to fetch a word detail record by ID/slug
 */
export function useWordDetail(id: string) {
  const { isReady, progress } = useDictionary();
  const [term, setTerm] = useState<TermRecord | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;

    let isCancelled = false;
    setIsLoading(true);

    findTerm(id)
      .then((res) => {
        if (!isCancelled) {
          setTerm(res || null);
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [id, isReady]);

  return { term, isLoading: !isReady || isLoading, isReady, progress };
}

/**
 * Custom hook to fetch a Kanji detail record & its compounds
 */
export function useKanjiDetail(literal: string) {
  const { isReady, progress } = useDictionary();
  const [kanji, setKanji] = useState<KanjiRecord | null | undefined>(undefined);
  const [compounds, setCompounds] = useState<TermRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;

    let isCancelled = false;
    setIsLoading(true);

    Promise.all([findKanji(literal), getCompoundsForKanji(literal, 12)])
      .then(([nextKanji, nextCompounds]) => {
        if (!isCancelled) {
          setKanji(nextKanji || null);
          setCompounds(nextCompounds);
        }
      })
      .finally(() => {
        if (!isCancelled) setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [literal, isReady]);

  return { kanji, compounds, isLoading: !isReady || isLoading, isReady, progress };
}

/**
 * Custom hook for dictionary initialization status
 */
export function useDictionaryLoad() {
  return useDictionary();
}
