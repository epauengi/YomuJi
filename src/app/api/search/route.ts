import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { DictionarySearchResult, KanjiDictionarySearchResult, TermRecord, KanjiRecord } from '@/types/dictionary';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

  if (!q) {
    return NextResponse.json({ terms: [], kanji: [] });
  }

  // Fallback if Supabase is not configured yet
  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json(
      { error: 'Supabase credentials not configured in .env.local', isFallback: true },
      { status: 503 }
    );
  }

  try {
    // 1. Query Terms with ILIKE and Trigram Search
    const { data: termData, error: termError } = await supabase
      .from('terms')
      .select('*')
      .or(`surface.ilike.%${q}%,reading.ilike.%${q}%,romaji.ilike.%${q}%,meanings_vi.cs.{${q}}`)
      .order('score', { ascending: false })
      .limit(limit);

    if (termError) throw termError;

    // 2. Query Kanji
    const { data: kanjiData, error: kanjiError } = await supabase
      .from('kanjis')
      .select('*')
      .or(`literal.eq.${q},han_viet.cs.{${q.toUpperCase()}},on_readings.cs.{${q}},kun_readings.cs.{${q}}`)
      .limit(8);

    if (kanjiError) throw kanjiError;

    const terms: DictionarySearchResult[] = (termData || []).map((t) => ({
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
    }));

    const kanji: KanjiDictionarySearchResult[] = (kanjiData || []).map((k) => ({
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
    }));

    return NextResponse.json({ terms, kanji });
  } catch (err: any) {
    console.error('API /api/search error:', err);
    return NextResponse.json({ error: err.message || 'Search query failed' }, { status: 500 });
  }
}
