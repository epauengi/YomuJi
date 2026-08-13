import { NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabaseClient';
import type { KanjiRecord } from '@/types/dictionary';

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
    const { data: kData, error } = await supabase
      .from('kanjis')
      .select('*')
      .eq('literal', decoded)
      .maybeSingle();

    if (error) throw error;
    if (!kData) {
      return NextResponse.json({ kanji: null }, { status: 404 });
    }

    const kanji: KanjiRecord = {
      literal: kData.literal,
      onReadings: kData.on_readings || [],
      kunReadings: kData.kun_readings || [],
      hanViet: kData.han_viet || [],
      meanings: kData.meanings || [],
      meaningsRaw: kData.meanings_raw || [],
      radical: kData.radical,
      penStrokes: kData.pen_strokes,
      strokeCount: kData.stroke_count,
      jlpt: kData.jlpt,
      grade: kData.grade,
      frequency: kData.frequency,
      unicode: kData.unicode,
      tags: kData.tags || [],
      components: kData.components || [],
      strokePaths: kData.stroke_paths || [],
    };

    return NextResponse.json({ kanji });
  } catch (err: any) {
    console.error('API /api/kanji error:', err);
    return NextResponse.json({ error: err.message || 'Kanji lookup failed' }, { status: 500 });
  }
}
