import { NextRequest, NextResponse } from 'next/server';
import { getGrammarRepository } from '@/lib/grammar/repository';
import { GRAMMAR_LEVELS } from '@/types/grammar';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim().slice(0, 100);
  const rawLevel = (searchParams.get('level') || '').trim().toUpperCase();
  const level = (GRAMMAR_LEVELS as readonly string[]).includes(rawLevel) ? rawLevel : undefined;
  const tag = (searchParams.get('tag') || '').trim().slice(0, 40) || undefined;

  const parsedLimit = Number(searchParams.get('limit'));
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(Math.floor(parsedLimit), 600) : 120;
  const parsedOffset = Number(searchParams.get('offset'));
  const offset = Number.isFinite(parsedOffset) && parsedOffset >= 0 ? Math.floor(parsedOffset) : 0;

  try {
    const data = await getGrammarRepository().list({ q, level, tag, limit, offset });
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('API /api/grammar failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Không thể tải danh sách ngữ pháp lúc này.' }, { status: 503 });
  }
}
