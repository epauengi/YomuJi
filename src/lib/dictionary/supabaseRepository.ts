import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { TermRecord, KanjiRecord, DictionarySearchResult, KanjiDictionarySearchResult } from '@/types/dictionary';
import type { DictionaryRepository, SearchTermsInput, SearchTermsResult, SearchKanjiInput, SearchKanjiResult } from './types';

function mapTermRow(t: any, q: string): DictionarySearchResult {
  return {
    term: {
      id: t.id,
      sequence: t.sequence,
      surface: t.surface,
      reading: t.reading,
      romaji: t.romaji,
      meaningsVi: t.meanings_vi || [],
      glossesRaw: t.glosses_raw || [],
      partOfSpeech: t.part_of_speech || [],
      tags: t.tags || [],
      score: t.score,
      isCommon: t.is_common,
      kanji: t.kanji || [],
      kanjiReadings: t.kanji_readings || [],
      examples: [],
      related: [],
      searchAliases: t.search_aliases || [],
      source: { jmdict: true },
    },
    score: t.score,
    matchType: t.surface === q ? 'exact-surface' : t.reading === q ? 'exact-reading' : 'partial',
  };
}

function mapKanjiRow(k: any, q: string): KanjiDictionarySearchResult {
  return {
    kanji: {
      literal: k.literal,
      onReadings: k.on_readings || [],
      kunReadings: k.kun_readings || [],
      hanViet: k.han_viet || [],
      meanings: k.meanings || [],
      meaningsRaw: k.meanings_raw || [],
      radical: k.radical,
      penStrokes: k.pen_strokes,
      strokeCount: k.stroke_count,
      jlpt: k.jlpt,
      grade: k.grade,
      frequency: k.frequency,
      unicode: k.unicode,
      tags: k.tags || [],
      components: k.components || [],
      strokePaths: k.stroke_paths || [],
    },
    score: 10000,
    matchType: k.literal === q ? 'exact-kanji' : 'han-viet',
  };
}

function deriveHanVietStr(termData: any): string | undefined {
  const kanjiReadings = termData.kanji_readings || [];
  const kanjiList = termData.kanji || [];
  const hvParts = kanjiReadings.map((r: any) => r.hanViet?.[0]).filter(Boolean);
  if (hvParts.length === kanjiList.length && hvParts.length > 0) {
    return hvParts.join(' ').toUpperCase();
  }
  return termData.han_viet_str || undefined;
}

export class SupabaseDictionaryRepository implements DictionaryRepository {
  async searchTerms(input: SearchTermsInput): Promise<SearchTermsResult> {
    const q = input.query.trim();
    const limit = Math.min(input.limit || 50, 100);
    if (!q || !isSupabaseConfigured || !supabase) return { terms: [] };

    const { data, error } = await supabase
      .from('terms')
      .select('*')
      .or(`surface.ilike.%${q}%,reading.ilike.%${q}%,romaji.ilike.%${q}%,meanings_vi.cs.{${q}}`)
      .order('score', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Supabase searchTerms: ${error.message}`);
    return { terms: (data || []).map((t) => mapTermRow(t, q)) };
  }

  async searchKanji(input: SearchKanjiInput): Promise<SearchKanjiResult> {
    const q = input.query.trim();
    const limit = Math.min(input.limit || 8, 50);
    if (!q || !isSupabaseConfigured || !supabase) return { kanji: [] };

    const { data, error } = await supabase
      .from('kanjis')
      .select('*')
      .or(`literal.eq.${q},han_viet.cs.{${q.toUpperCase()}},on_readings.cs.{${q}},kun_readings.cs.{${q}}`)
      .limit(limit);

    if (error) throw new Error(`Supabase searchKanji: ${error.message}`);
    return { kanji: (data || []).map((k) => mapKanjiRow(k, q)) };
  }

  async getTermByIdOrSlug(slug: string): Promise<TermRecord | null> {
    const decoded = decodeURIComponent(slug).trim();
    if (!decoded || !isSupabaseConfigured || !supabase) return null;

    const { data, error } = await supabase
      .from('terms')
      .select('*')
      .or(`id.eq.${decoded},surface.eq.${decoded},reading.eq.${decoded}`)
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Supabase getTermByIdOrSlug: ${error.message}`);
    if (!data) return null;

    return {
      id: data.id,
      sequence: data.sequence,
      surface: data.surface,
      reading: data.reading,
      romaji: data.romaji,
      hanVietStr: deriveHanVietStr(data),
      meaningsVi: data.meanings_vi || [],
      glossesRaw: data.glosses_raw || [],
      partOfSpeech: data.part_of_speech || [],
      tags: data.tags || [],
      score: data.score,
      isCommon: data.is_common,
      kanji: data.kanji || [],
      kanjiReadings: data.kanji_readings || [],
      examples: [],
      related: [],
      searchAliases: data.search_aliases || [],
      source: { jmdict: true },
    };
  }

  async getKanjiByLiteral(literal: string): Promise<KanjiRecord | null> {
    const decoded = decodeURIComponent(literal).trim();
    if (!decoded || !isSupabaseConfigured || !supabase) return null;

    const { data, error } = await supabase
      .from('kanjis')
      .select('*')
      .eq('literal', decoded)
      .maybeSingle();

    if (error) throw new Error(`Supabase getKanjiByLiteral: ${error.message}`);
    if (!data) return null;
    return mapKanjiRow(data, decoded).kanji;
  }
}
