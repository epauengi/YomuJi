import { NextResponse } from 'next/server';
import { fetchKotoba, KotobaError, KotobaTimeoutError } from '@/lib/kotoba';
import { isConjugationQuery, type KotobaMode } from '@/types/kotoba';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');
  const q = searchParams.get('q');
  const seqParam = searchParams.get('seq');

  if (mode !== 'search' && mode !== 'forms') {
    return NextResponse.json(
      { error: 'Invalid mode: must be "search" or "forms"' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (!q || !isConjugationQuery(q)) {
    return NextResponse.json(
      { error: 'Invalid q parameter: must be a Japanese single word (<=80 chars) containing kana' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  let sequence: number | undefined;

  if (mode === 'search') {
    if (seqParam !== null && seqParam.trim() !== '') {
      return NextResponse.json(
        { error: 'seq parameter is only allowed in forms mode' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
  } else {
    // mode === 'forms'
    if (seqParam !== null && seqParam.trim() !== '') {
      const trimmedSeq = seqParam.trim();
      if (!/^[1-9]\d{0,14}$/.test(trimmedSeq)) {
        return NextResponse.json(
          { error: 'Invalid seq parameter: must be a positive integer <= 15 digits' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }
      sequence = Number(trimmedSeq);
      if (!Number.isSafeInteger(sequence)) {
        return NextResponse.json(
          { error: 'Invalid seq parameter: exceeds safe integer limit' },
          { status: 400, headers: { 'Cache-Control': 'no-store' } }
        );
      }
    }
  }

  try {
    const data = await fetchKotoba(mode as KotobaMode, q.trim(), sequence);
    const isEmpty = data.entries.length === 0 && data.sections.length === 0;
    const cacheControl = isEmpty
      ? 'public, max-age=30, s-maxage=30'
      : 'public, max-age=86400, stale-while-revalidate=86400';

    return NextResponse.json(data, {
      status: 200,
      headers: {
        'Cache-Control': cacheControl,
      },
    });
  } catch (err: unknown) {
    if (err instanceof KotobaTimeoutError || (err as { status?: number })?.status === 504) {
      return NextResponse.json(
        { error: 'Gateway Timeout' },
        { status: 504, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    if ((err as { status?: number })?.status === 503) {
      return NextResponse.json(
        { error: 'Service Unavailable' },
        { status: 503, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    return NextResponse.json(
      { error: 'Bad Gateway' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
