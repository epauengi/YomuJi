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
    const kanji = await repository.getKanjiByLiteral(decoded);

    if (!kanji) {
      return NextResponse.json({ kanji: null }, { status: 404 });
    }

    return NextResponse.json({ kanji });
  } catch (error: unknown) {
    console.error('API /api/kanji error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Kanji lookup failed' },
      { status: 500 },
    );
  }
}
