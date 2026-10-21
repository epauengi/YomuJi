let currentAudio: HTMLAudioElement | null = null;
let playbackRun = 0;

interface PlayTTSOptions {
  voice?: string;
  rate?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

export function stopCurrentAudio() {
  playbackRun++;
  if (currentAudio) {
    const audio = currentAudio;
    currentAudio = null;
    audio.onplay = audio.onended = audio.onerror = null;
    audio.pause();
    audio.currentTime = 0;
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

export async function playJapaneseAudio(text: string, options: PlayTTSOptions = {}): Promise<void> {
  const cleanText = text.trim();
  if (!cleanText) return;

  stopCurrentAudio();

  const { voice = 'ja-JP-NanamiNeural', rate = '0%', onStart, onEnd, onError } = options;
  const run = playbackRun;
  let fallbackStarted = false;
  let finished = false;
  const active = () => run === playbackRun && !finished;
  const start = () => {
    if (active()) onStart?.();
  };
  const end = () => {
    if (!active()) return;
    finished = true;
    currentAudio = null;
    onEnd?.();
  };
  const fail = (err: unknown) => {
    if (!active()) return;
    finished = true;
    onError?.(err);
    if (run === playbackRun) onEnd?.();
  };
  const fallback = () => {
    // A media error can fire both onerror and reject play(); only one owns fallback.
    if (!active() || fallbackStarted) return;
    fallbackStarted = true;
    if (currentAudio) {
      const audio = currentAudio;
      currentAudio = null;
      audio.onplay = audio.onended = audio.onerror = null;
      audio.pause();
    }
    fallbackWebSpeech(cleanText, start, end, fail);
  };

  const audioUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&voice=${encodeURIComponent(voice)}&rate=${encodeURIComponent(rate)}`;

  try {
    const audio = new Audio(audioUrl);
    currentAudio = audio;
    audio.onplay = () => {
      if (!fallbackStarted) start();
    };
    audio.onended = () => {
      if (!fallbackStarted) end();
    };
    audio.onerror = fallback;
    await audio.play();
  } catch (err) {
    if ((err as { name?: string } | null)?.name === 'AbortError') {
      if (!fallbackStarted) end();
      return;
    }
    fallback();
  }
}

function fallbackWebSpeech(
  text: string,
  onStart?: () => void,
  onEnd?: () => void,
  onError?: (err: unknown) => void
) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    onError?.(new Error('Speech synthesis not supported'));
    onEnd?.();
    return;
  }

  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.9;
    utterance.pitch = 1;

    const voices = window.speechSynthesis.getVoices();
    const japaneseVoice = voices.find((v) => v.lang.toLowerCase().startsWith('ja'));
    if (japaneseVoice) utterance.voice = japaneseVoice;

    utterance.onstart = () => onStart?.();
    utterance.onend = () => onEnd?.();
    utterance.onerror = (e) => {
      onError?.(e);
      onEnd?.();
    };

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    onError?.(err);
    onEnd?.();
  }
}
