import { NextResponse } from 'next/server';
import { EdgeTTS, Constants } from '@andresaya/edge-tts';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get('text')?.trim();
  const voice = searchParams.get('voice') || 'ja-JP-NanamiNeural';
  const rate = searchParams.get('rate') || '0%';

  if (!text) {
    return NextResponse.json({ error: 'Text parameter is required' }, { status: 400 });
  }

  if (text.length > 500) {
    return NextResponse.json({ error: 'Text too long (max 500 characters)' }, { status: 400 });
  }

  try {
    const tts = new EdgeTTS();
    await tts.synthesize(text, voice, {
      rate,
      outputFormat: Constants.OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
    });

    const buffer = tts.toBuffer();

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Edge TTS Error:', error);
    return NextResponse.json({ error: 'Failed to synthesize speech' }, { status: 500 });
  }
}
