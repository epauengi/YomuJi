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
import type {
  TermRecord,
  KanjiRecord,
  DictionarySearchResult,
  KanjiDictionarySearchResult,
} from '@/types/dictionary';

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
      } catch (error) {
        console.error('Error executing search:', error);
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

type DetailState<T> =
  | { key: string; status: 'loading'; value?: undefined; error: null }
  | { key: string; status: 'found'; value: T; error: null }
  | { key: string; status: 'not-found'; value?: undefined; error: null }
  | { key: string; status: 'error'; value?: undefined; error: string };

function loadingState<T>(key: string): DetailState<T> {
  return { key, status: 'loading', error: null };
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Không thể tải dữ liệu từ điển. Vui lòng thử lại.';
}

/**
 * Fetch a word detail record without depending on global search readiness.
 */
export function useWordDetail(id: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DetailState<TermRecord>>(() => loadingState(id));
  const currentState = state.key === id ? state : loadingState<TermRecord>(id);

  useEffect(() => {
    const controller = new AbortController();
    setState(loadingState(id));

    findTerm(id, controller.signal)
      .then((term) => {
        if (controller.signal.aborted) return;
        setState(term
          ? { key: id, status: 'found', value: term, error: null }
          : { key: id, status: 'not-found', error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ key: id, status: 'error', error: errorMessage(error) });
      });

    return () => controller.abort();
  }, [id, attempt]);

  return {
    term: currentState.status === 'found'
      ? currentState.value
      : currentState.status === 'not-found'
        ? null
        : undefined,
    status: currentState.status,
    error: currentState.error,
    isLoading: currentState.status === 'loading',
    retry: () => setAttempt((value) => value + 1),
  };
}

/**
 * Fetch Kanji first; compounds are ancillary and never classify the Kanji.
 */
export function useKanjiDetail(literal: string) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<DetailState<KanjiRecord>>(() => loadingState(literal));
  const [compoundState, setCompoundState] = useState<{ key: string; terms: TermRecord[] }>({
    key: literal,
    terms: [],
  });
  const currentState = state.key === literal ? state : loadingState<KanjiRecord>(literal);
  const compounds = compoundState.key === literal ? compoundState.terms : [];

  useEffect(() => {
    const controller = new AbortController();
    setState(loadingState(literal));
    setCompoundState({ key: literal, terms: [] });

    findKanji(literal, controller.signal)
      .then(async (kanji) => {
        if (controller.signal.aborted) return;
        if (!kanji) {
          setState({ key: literal, status: 'not-found', error: null });
          return;
        }

        setState({ key: literal, status: 'found', value: kanji, error: null });

        try {
          const terms = await getCompoundsForKanji(literal, 12);
          if (!controller.signal.aborted) setCompoundState({ key: literal, terms });
        } catch (error) {
          console.error('Failed to load Kanji compounds:', error);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ key: literal, status: 'error', error: errorMessage(error) });
      });

    return () => controller.abort();
  }, [literal, attempt]);

  return {
    kanji: currentState.status === 'found'
      ? currentState.value
      : currentState.status === 'not-found'
        ? null
        : undefined,
    compounds,
    status: currentState.status,
    error: currentState.error,
    isLoading: currentState.status === 'loading',
    retry: () => setAttempt((value) => value + 1),
  };
}

export function useDictionaryLoad() {
  return useDictionary();
}
