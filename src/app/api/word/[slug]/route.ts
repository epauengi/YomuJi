import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { TermRecord } from '@/types/dictionary';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug).trim();

  if (!decoded) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
  }

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json(
      { error: 'Supabase credentials not configured in .env.local', isFallback: true },
      { status: 503 }
    );
  }

  try {
    const { data: termData, error } = await supabase
      .from('terms')
      .select('*')
      .or(`id.eq.${decoded},surface.eq.${decoded},reading.eq.${decoded}`)
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!termData) {
      return NextResponse.json({ term: null }, { status: 444 });
    }

    const kanjiReadings = termData.kanji_readings || [];
    const kanjiList = termData.kanji || [];
    const hvParts = kanjiReadings.map((r: any) => r.hanViet?.[0]).filter(Boolean);
    const derivedHanVietStr = (hvParts.length === kanjiList.length && hvParts.length > 0)
      ? hvParts.join(' ').toUpperCase()
      : (termData.han_viet_str || undefined);

    const term: TermRecord = {
      id: termData.id,
      sequence: termData.sequence,
      surface: termData.surface,
      reading: termData.reading,
      romaji: termData.romaji,
      hanVietStr: derivedHanVietStr,
      meaningsVi: termData.meanings_vi || [],
      glossesRaw: termData.glosses_raw || [],
      partOfSpeech: termData.part_of_speech || [],
      tags: termData.tags || [],
      score: termData.score,
      isCommon: termData.is_common,
      kanji: kanjiList,
      kanjiReadings: kanjiReadings,
      examples: [],
      related: [],
      searchAliases: termData.search_aliases || [],
      source: { jmdict: true },
    };

    return NextResponse.json({ term });
  } catch (err: any) {
    console.error('API /api/word error:', err);
    return NextResponse.json({ error: err.message || 'Word lookup failed' }, { status: 500 });
  }
}
