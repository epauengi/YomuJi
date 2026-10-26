import { NextRequest, NextResponse } from 'next/server';
import { type Category, type Mode } from '@/lib/jlpt';
import { getJlptCatalog, getJlptPaper, gradeJlptSubmission, JlptInputError } from '@/lib/jlptData';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PAYLOAD_BYTES = 20480; // ~20KB limit
const VALID_CATEGORIES = new Set<string>(['vocabulary_kanji', 'grammar', 'reading']);
const VALID_MODES = new Set<string>(['mock', 'practice']);

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');
    const examParam = searchParams.get('exam');
    const category = searchParams.get('category');

    // No query params -> return catalog
    if (!mode && !examParam && !category) {
      const catalog = getJlptCatalog();
      return NextResponse.json(catalog, { status: 200 });
    }

    // Validate mode
    if (!mode || !VALID_MODES.has(mode)) {
      return NextResponse.json(
        { error: 'Chế độ không hợp lệ. Phải là "mock" hoặc "practice"' },
        { status: 400 }
      );
    }

    // Validate exam
    const examNum = Number(examParam);
    if (!examParam || !Number.isInteger(examNum) || examNum < 1 || examNum > 10) {
      return NextResponse.json(
        { error: 'Số đề không hợp lệ. Phải là số nguyên từ 1 đến 10' },
        { status: 400 }
      );
    }

    // Validate category for practice mode
    if (mode === 'practice') {
      if (!category || !VALID_CATEGORIES.has(category)) {
        return NextResponse.json(
          { error: 'Phần thi không hợp lệ cho chế độ luyện tập (vocabulary_kanji, grammar, reading)' },
          { status: 400 }
        );
      }
    } else if (category && !VALID_CATEGORIES.has(category)) {
      return NextResponse.json(
        { error: 'Phần thi không hợp lệ (vocabulary_kanji, grammar, reading)' },
        { status: 400 }
      );
    }

    const paper = getJlptPaper(
      mode as Mode,
      examNum,
      category ? (category as Category) : undefined
    );

    return NextResponse.json(paper, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof JlptInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[JLPT API GET Error]:', err);
    return NextResponse.json(
      { error: 'Dữ liệu đề thi tạm thời không khả dụng, vui lòng thử lại sau.' },
      { status: 503 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: 'Dung lượng yêu cầu vượt quá giới hạn 20KB' },
        { status: 413 }
      );
    }

    const rawBody = await req.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_PAYLOAD_BYTES) {
      return NextResponse.json(
        { error: 'Dung lượng yêu cầu vượt quá giới hạn 20KB' },
        { status: 413 }
      );
    }

    if (!rawBody.trim()) {
      return NextResponse.json({ error: 'Nội dung gửi lên trống' }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Định dạng JSON không hợp lệ' }, { status: 400 });
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Thân yêu cầu không hợp lệ' }, { status: 400 });
    }

    const { mode, exam, category, answers } = body as {
      mode?: unknown;
      exam?: unknown;
      category?: unknown;
      answers?: unknown;
    };

    if (typeof mode !== 'string' || !VALID_MODES.has(mode)) {
      return NextResponse.json(
        { error: 'Chế độ không hợp lệ. Phải là "mock" hoặc "practice"' },
        { status: 400 }
      );
    }

    const examNum = Number(exam);
    if (typeof exam !== 'number' || !Number.isInteger(examNum) || examNum < 1 || examNum > 10) {
      return NextResponse.json(
        { error: 'Số đề không hợp lệ. Phải là số nguyên từ 1 đến 10' },
        { status: 400 }
      );
    }

    if (mode === 'practice') {
      if (typeof category !== 'string' || !VALID_CATEGORIES.has(category)) {
        return NextResponse.json(
          { error: 'Phần thi không hợp lệ cho chế độ luyện tập' },
          { status: 400 }
        );
      }
    } else if (category !== undefined && (typeof category !== 'string' || !VALID_CATEGORIES.has(category))) {
      return NextResponse.json(
        { error: 'Phần thi không hợp lệ' },
        { status: 400 }
      );
    }

    if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
      return NextResponse.json(
        { error: 'Danh sách câu trả lời phải là một đối tượng' },
        { status: 400 }
      );
    }

    const answersMap: Record<string, number> = Object.create(null);
    for (const qid of Object.getOwnPropertyNames(answers)) {
      const choice = (answers as Record<string, unknown>)[qid];
      if (typeof choice !== 'number' || !Number.isInteger(choice) || choice < 1 || choice > 4) {
        return NextResponse.json(
          { error: `Lựa chọn không hợp lệ cho câu hỏi ${qid}` },
          { status: 400 }
        );
      }
      answersMap[qid] = choice;
    }

    const result = gradeJlptSubmission(
      mode as Mode,
      examNum,
      category ? (category as Category) : undefined,
      answersMap
    );
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof JlptInputError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error('[JLPT API POST Error]:', err);
    return NextResponse.json(
      { error: 'Dữ liệu đề thi tạm thời không khả dụng, vui lòng thử lại sau.' },
      { status: 503 }
    );
  }
}
