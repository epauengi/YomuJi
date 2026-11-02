'use client';

import { useEffect, useState } from 'react';
import { lookupWordRoute } from '@/lib/dictionaryService';
import type { TermLookupResponse } from '@/types/dictionary';
import {
  enrichTermWithSenseRecord,
  loadSenseDetailForTerm,
} from '@/lib/dictionary/senseDetails';
import {
  searchDictionary,
  searchKanjiDictionary,
  findKanji,
  getCompoundsForKanji,
  useDictionary,
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
  const [termResults, setTermResults] = useState<DictionarySearchResult[]>([]);
  const [kanjiResults, setKanjiResults] = useState<KanjiDictionarySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 1) {
      setTermResults([]);
      setKanjiResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();

    let isCancelled = false;
    setIsSearching(true);

    const timer = setTimeout(async () => {
      try {
        const [terms, kanji] = await Promise.all([
          searchDictionary(trimmed, limit, controller.signal),
          searchKanjiDictionary(trimmed, 6, controller.signal),
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
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, limit]);

  return { termResults, kanjiResults, isSearching };
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
export function useWordDetail(slug: string, sequence?: string, initial?: TermLookupResponse) {
  const key = JSON.stringify([slug, sequence]);
  const [prevKey, setPrevKey] = useState(key);
  const [attempt, setAttempt] = useState(0);
  const initialState: DetailState<TermLookupResponse> = initial
    ? { key, status: 'found', value: initial, error: null }
    : loadingState(key);
  const [state, setState] = useState(initialState);

  if (prevKey !== key) {
    setPrevKey(key);
    setAttempt(0);
    setState(initialState);
  }

  const currentState = state.key === key ? state : initialState;

  useEffect(() => {
    if (initial && attempt === 0) return;
    const controller = new AbortController();
    setState(loadingState(key));
    lookupWordRoute(slug, controller.signal, sequence)
      .then((value) => {
        if (!controller.signal.aborted) setState({ key, status: 'found', value, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState({ key, status: 'error', error: errorMessage(error) });
      });
    return () => controller.abort();
  }, [slug, sequence, key, attempt, initial]);

  const currentTerm = currentState.status === 'found' ? currentState.value.term : undefined;
  const currentTermId = currentTerm?.id;
  const currentSequence = currentTerm?.sequence;
  const hasSenses = Boolean(currentTerm?.senses && currentTerm.senses.length > 0);

  useEffect(() => {
    if (!currentTerm || hasSenses) return;
    if (typeof currentSequence !== 'number' || !Number.isInteger(currentSequence) || currentSequence <= 0) return;

    const controller = new AbortController();

    loadSenseDetailForTerm(currentTerm, controller.signal)
      .then((record) => {
        if (controller.signal.aborted || !record) return;
        setState((prev) => {
          const baseState = prev.key === key ? prev : initialState;
          if (baseState.status !== 'found' || !baseState.value.term) return prev;
          if (baseState.value.term.id !== record.id) return prev;
          if (baseState.value.term.senses && baseState.value.term.senses.length > 0) return prev;
          return {
            key,
            status: 'found',
            error: null,
            value: {
              ...baseState.value,
              term: enrichTermWithSenseRecord(baseState.value.term, record),
            },
          };
        });
      })
      .catch(() => {
        // preserve existing flat UI
      });

    return () => controller.abort();
  }, [key, currentTermId, currentSequence, hasSenses, currentTerm, initial]);

  return {
    term: currentState.status === 'found' ? currentState.value.term : undefined,
    alternatives: currentState.status === 'found' ? currentState.value.alternatives : undefined,
    status: currentState.status,
    error: currentState.error,
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
