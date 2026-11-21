import { NextResponse } from 'next/server';
import { getTokenizer } from '@/lib/kuromojiServer';
import { analyzeTokens } from '@/lib/sentenceParse';
import { getGrammarRepository } from '@/lib/grammar/repository';
import { matchSentenceGrammar } from '@/lib/grammar/matcher';

export const runtime = 'nodejs';
const MAX_LENGTH = 500;

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const text = typeof body === 'object' && body && 'text' in body && typeof body.text === 'string'
    ? body.text.normalize('NFKC').trim() : '';
  if (!text || text.length > MAX_LENGTH) return NextResponse.json({ error: `Cần 1–${MAX_LENGTH} ký tự.` }, { status: 400 });
  try {
    const [tokenizer, grammarPoints] = await Promise.all([
      getTokenizer(),
      getGrammarRepository().getAllForMatching().catch(() => []),
    ]);
    const sentences = analyzeTokens(tokenizer.tokenize(text));
    const grammarMatches = matchSentenceGrammar(sentences, grammarPoints);
    return NextResponse.json({ sentences, grammarMatches });
  } catch (error) {
    console.error('API /api/parse failed', error instanceof Error ? error.name : 'unknown');
    return NextResponse.json({ error: 'Không thể phân tích câu lúc này.' }, { status: 503 });
  }
}
