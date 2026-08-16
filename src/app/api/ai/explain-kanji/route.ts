import { NextResponse } from 'next/server';

export interface KanjiAiExplanation {
  vietnameseMeaning: string;
  etymology: string;
  mnemonic: string;
  nuance: string;
  compounds: Array<{
    word: string;
    reading: string;
    meaning: string;
    jlpt?: string;
  }>;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured on server' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { literal, hanViet, meanings, components, onReadings, kunReadings } = body;

    if (!literal) {
      return NextResponse.json({ error: 'Missing literal parameter' }, { status: 400 });
    }

    const prompt = `Bạn là chuyên gia ngôn ngữ học tiếng Nhật và Hán Nôm của từ điển YomuJi. Hãy giải thích chi tiết chữ Hán (Kanji) sau cho người học tiếng Nhật người Việt:
- Chữ Hán: ${literal}
- Âm Hán Việt: ${Array.isArray(hanViet) ? hanViet.join(', ') : hanViet || 'Chưa rõ'}
- Nghĩa gợi ý: ${Array.isArray(meanings) ? meanings.join(', ') : meanings || 'Chưa rõ'}
- Bộ thủ/Thành phần: ${Array.isArray(components) ? components.join(', ') : components || 'Chưa rõ'}
- Âm On: ${Array.isArray(onReadings) ? onReadings.join(', ') : onReadings || 'Chưa rõ'}
- Âm Kun: ${Array.isArray(kunReadings) ? kunReadings.join(', ') : kunReadings || 'Chưa rõ'}

Hãy phân tích và trả về DUY NHẤT một JSON object hợp lệ (không kèm bất kỳ văn bản ngoài nào, không dùng markdown block khác кроме JSON) theo cấu trúc sau:
{
  "vietnameseMeaning": "Giải thích chi tiết nghĩa tiếng Việt của chữ này (khoảng 1-2 câu súc tích, chuẩn xác)",
  "etymology": "Nguồn gốc chiết tự / xuất xứ hình thành chữ Hán (tượng hình, chỉ sự, hội ý, hình thanh - chữ mô tả hình ảnh gì)",
  "mnemonic": "Mẹo ghi nhớ chữ dễ thuộc nhất bằng cách liên tưởng các bộ thủ hoặc câu chuyện vui",
  "nuance": "Sắc thái ý nghĩa & lưu ý khi sử dụng chữ này trong tiếng Nhật hiện đại (phân biệt với các từ gần nghĩa nếu có)",
  "compounds": [
    { "word": "từ ghép 1", "reading": "cách đọc hiragana", "meaning": "nghĩa tiếng Việt", "jlpt": "cấp độ JLPT như N5, N4, N3, N2 hoặc N1" },
    { "word": "từ ghép 2", "reading": "cách đọc hiragana", "meaning": "nghĩa tiếng Việt", "jlpt": "N..." },
    { "word": "từ ghép 3", "reading": "cách đọc hiragana", "meaning": "nghĩa tiếng Việt", "jlpt": "N..." }
  ]
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
        },
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Gemini API Error:', res.status, errorText);
      return NextResponse.json({ error: `Gemini API Error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return NextResponse.json({ error: 'No response generated from Gemini' }, { status: 500 });
    }

    const parsed: KanjiAiExplanation = JSON.parse(candidateText);
    return NextResponse.json({ explanation: parsed });
  } catch (err: any) {
    console.error('API /api/ai/explain-kanji Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
