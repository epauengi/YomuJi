import { NextResponse } from 'next/server';
import {
  DEFAULT_LIMIT,
  MAX_QUERY_LENGTH,
  fetchTatoebaExamples,
  normalizeRawQuery,
  parseLimit,
} from '@/lib/tatoeba';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get('q');
  const query = normalizeRawQuery(rawQuery);

  if (!query) {
    return NextResponse.json({ error: 'Missing or empty query parameter "q"' }, { status: 400 });
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: `Query exceeds maximum length of ${MAX_QUERY_LENGTH} characters` },
      { status: 400 }
    );
  }

  const limit = parseLimit(searchParams.get('limit'), DEFAULT_LIMIT);

  try {
    const examples = await fetchTatoebaExamples(query, { limit });
    return NextResponse.json(
      {
        query,
        count: examples.length,
        examples,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error: unknown) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      return NextResponse.json({ error: 'Tatoeba service timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to fetch examples from Tatoeba' }, { status: 502 });
  }
}
