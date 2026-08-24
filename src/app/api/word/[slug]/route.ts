import { NextResponse } from 'next/server';
import { getDictionaryRepository } from '@/lib/dictionary';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const decoded = decodeURIComponent(slug).trim();

  if (!decoded) {
    return NextResponse.json({ error: 'Missing slug parameter' }, { status: 400 });
  }

  try {
    const repository = getDictionaryRepository();
    const term = await repository.getTermByIdOrSlug(decoded);

    if (!term) {
      return NextResponse.json({ term: null }, { status: 404 });
    }

    return NextResponse.json({ term });
  } catch (error: unknown) {
    console.error('API /api/word error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Word lookup failed' },
      { status: 500 },
    );
  }
}
