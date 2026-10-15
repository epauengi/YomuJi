import { NextResponse } from 'next/server';
import { resolveWordRoute } from '@/lib/dictionary/resolveWordRoute';
import { isDictionaryBackendConfigured } from '@/lib/dictionary';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug: rawSlug } = await params;
  let slug: string;
  try { slug = decodeURIComponent(rawSlug); } catch { slug = ''; }
  const sequence = new URL(request.url).searchParams.get('id') ?? undefined;
  if (!slug.trim() || slug.length > 512 || (sequence !== undefined && !/^[1-9]\d{0,14}$/.test(sequence))) {
    return NextResponse.json({ error: 'Invalid word route' }, { status: 400 });
  }

  if (!isDictionaryBackendConfigured()) {
    return NextResponse.json({ error: 'Dictionary backend unavailable' }, { status: 503 });
  }

  try {
    const result = await resolveWordRoute(slug.trim(), sequence);
    return NextResponse.json(result, { status: result.term || result.alternatives?.length ? 200 : 404 });
  } catch (error: unknown) {
    console.error('API /api/word error:', error);
    return NextResponse.json({ error: 'Word lookup failed' }, { status: 500 });
  }
}
