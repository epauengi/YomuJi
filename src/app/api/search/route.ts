import { NextResponse } from 'next/server';
import { getDictionaryRepository } from '@/lib/dictionary';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);

  if (!q) {
    return NextResponse.json({ terms: [], kanji: [] });
  }

  try {
    const repository = getDictionaryRepository();

    const [{ terms }, { kanji }] = await Promise.all([
      repository.searchTerms({ query: q, limit }),
      repository.searchKanji({ query: q, limit: 8 }),
    ]);

    return NextResponse.json({ terms, kanji });
  } catch (err: any) {
    console.error('API /api/search error:', err);
    return NextResponse.json({ error: err.message || 'Search query failed' }, { status: 500 });
  }
}
