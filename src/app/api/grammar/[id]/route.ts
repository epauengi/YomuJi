import { NextResponse } from 'next/server';
import { getGrammarRepository } from '@/lib/grammar/repository';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const cleanId = decodeURIComponent(id || '').trim();
  if (!cleanId || cleanId.length > 120) {
    return NextResponse.json({ error: 'Mã ngữ pháp không hợp lệ.' }, { status: 400 });
  }

  try {
    const grammar = await getGrammarRepository().getById(cleanId);
    if (!grammar) {
      return NextResponse.json({ error: 'Không tìm thấy điểm ngữ pháp.' }, { status: 404 });
    }
    return NextResponse.json(
      { grammar },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
        },
      }
    );
  } catch (error) {
    console.error('API /api/grammar/[id] failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Không thể tải chi tiết ngữ pháp.' }, { status: 503 });
  }
}
