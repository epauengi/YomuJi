import type { SavedBookmark } from './browserState';

export function reviewWords(entries: SavedBookmark[]): SavedBookmark[] {
  return entries.flatMap((entry) => {
    if (entry.kind !== 'term') return [];
    const surface = entry.surface.trim();
    const reading = entry.reading.trim();
    const meanings = entry.meanings
      .map((meaning) => meaning.replace(/<[^>]*>|\[\/?(?:b|i|u)\]/gi, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    return surface && reading && meanings.length ? [{ ...entry, surface, reading, meanings }] : [];
  });
}

export type ReviewSession = {
  words: SavedBookmark[];
  index: number;
  revealed: boolean;
  missed: SavedBookmark[];
};

type ReviewAction =
  | { type: 'start'; entries: SavedBookmark[] }
  | { type: 'reveal' }
  | { type: 'answer'; remembered: boolean }
  | { type: 'retry' }
  | { type: 'exit' };

export function reviewReducer(state: ReviewSession | null, action: ReviewAction): ReviewSession | null {
  if (action.type === 'exit') return null;
  if (action.type === 'start') {
    // ponytail: ten most recently saved eligible words; add selection only when longer sessions are needed.
    const words = reviewWords(action.entries).slice(0, 10);
    return words.length ? { words, index: 0, revealed: false, missed: [] } : null;
  }
  if (!state) return state;
  if (action.type === 'retry') {
    return state.index === state.words.length && state.missed.length
      ? { words: state.missed, index: 0, revealed: false, missed: [] }
      : state;
  }
  if (state.index >= state.words.length) return state;
  if (action.type === 'reveal') return { ...state, revealed: true };
  if (!state.revealed) return state;
  return {
    ...state,
    index: state.index + 1,
    revealed: false,
    missed: action.remembered ? state.missed : [...state.missed, state.words[state.index]],
  };
}
