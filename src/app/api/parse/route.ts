import { NextResponse } from 'next/server';
import { getTokenizer } from '@/lib/kuromojiServer';
import { analyzeTokens } from '@/lib/sentenceParse';

export const runtime = 'nodejs';
const MAX_LENGTH = 500;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const text = typeof body === 'object' && body && 'text' in body && typeof body.text === 'string'
    ? body.text.normalize('NFKC').trim() : '';
  if (!text || text.length > MAX_LENGTH) return NextResponse.json({ error: `Cần 1–${MAX_LENGTH} ký tự.` }, { status: 400 });
  try {
    return NextResponse.json({ sentences: analyzeTokens((await getTokenizer()).tokenize(text)) });
  } catch (error) {
    console.error('API /api/parse failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Không thể phân tích câu lúc này.' }, { status: 503 });
  }
}
