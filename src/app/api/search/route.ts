import { NextResponse } from 'next/server';
import { getDictionaryRepository, isDictionaryBackendConfigured } from '@/lib/dictionary';
import {
  normalizeKanjiSearchResult,
  normalizeSearchResult,
} from '@/lib/dictionary/formatters';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim() || '';
  const rawLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;

  if (!q) {
    return NextResponse.json({ source: 'api', terms: [], kanji: [] });
  }

  if (!isDictionaryBackendConfigured()) {
    return NextResponse.json(
      { error: 'Chưa cấu hình dịch vụ từ điển trực tuyến.', source: 'api' },
      { status: 503 },
    );
  }

  try {
    const repository = getDictionaryRepository();

    const [{ terms }, { kanji }] = await Promise.all([
      repository.searchTerms({ query: q, limit }),
      repository.searchKanji({ query: q, limit: 8 }),
    ]);

    return NextResponse.json({
      source: 'api',
      terms: (terms || []).map(normalizeSearchResult),
      kanji: (kanji || []).map(normalizeKanjiSearchResult),
    });
  } catch (err: any) {
    console.error('API /api/search error:', err);
    return NextResponse.json({ error: err.message || 'Search query failed', source: 'api' }, { status: 500 });
  }
}
