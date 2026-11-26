import { NextResponse } from 'next/server';
import { getDictionaryRepository, getProperNamesRepository, isDictionaryBackendConfigured } from '@/lib/dictionary';
import {
  normalizeKanjiSearchResult,
  normalizeSearchResult,
} from '@/lib/dictionary/formatters';
import {
  getSecondsUntilVietnamMidnight,
  getVietnamDayKey,
} from '@/lib/dictionary/randomTerm';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('random') === 'daily') {
    if (!isDictionaryBackendConfigured()) {
      return NextResponse.json({ error: 'Dictionary backend unavailable.' }, { status: 503 });
    }
    try {
      const now = new Date();
      const term = await getDictionaryRepository().getRandomTerm(getVietnamDayKey(now));
      const cacheSeconds = getSecondsUntilVietnamMidnight(now);
      return NextResponse.json({ term }, {
        headers: { 'Cache-Control': `public, max-age=0, s-maxage=${cacheSeconds}` },
      });
    } catch (error) {
      console.error('API /api/search random error:', error);
      return NextResponse.json({ error: 'Daily term unavailable.' }, { status: 503 });
    }
  }

  const q = searchParams.get('q')?.trim() || '';
  const rawLimit = Number.parseInt(searchParams.get('limit') || '50', 10);
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;

  if (!q) {
    return NextResponse.json({ source: 'api', terms: [], kanji: [], names: [], namesSupported: false });
  }

  if (!isDictionaryBackendConfigured()) {
    return NextResponse.json(
      { error: 'Chưa cấu hình dịch vụ từ điển trực tuyến.', source: 'api' },
      { status: 503 },
    );
  }

  try {
    const repository = getDictionaryRepository();
    const namesRepository = getProperNamesRepository() ?? repository;

    const [{ terms }, { kanji }, { names, supported: namesSupported }] = await Promise.all([
      repository.searchTerms({ query: q, limit }),
      repository.searchKanji({ query: q, limit: 8 }),
      namesRepository.searchNames({ query: q, limit: Math.min(limit, 30) }),
    ]);

    return NextResponse.json({
      source: 'api',
      terms: (terms || []).map(normalizeSearchResult),
      kanji: (kanji || []).map(normalizeKanjiSearchResult),
      names: names || [],
      namesSupported: Boolean(namesSupported),
    });
  } catch (err: any) {
    console.error('API /api/search error:', err);
    return NextResponse.json({ error: err.message || 'Search query failed', source: 'api' }, { status: 500 });
  }
}
