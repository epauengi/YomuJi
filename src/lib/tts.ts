let currentAudio: HTMLAudioElement | null = null;

interface PlayTTSOptions {
  voice?: string;
  rate?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: unknown) => void;
}

export function stopCurrentAudio() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
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

  const audioUrl = `/api/tts?text=${encodeURIComponent(cleanText)}&voice=${encodeURIComponent(voice)}&rate=${encodeURIComponent(rate)}`;

  try {
    const audio = new Audio(audioUrl);
    currentAudio = audio;

    audio.onplay = () => {
      onStart?.();
    };

    audio.onended = () => {
      if (currentAudio === audio) {
        currentAudio = null;
      }
      onEnd?.();
    };

    audio.onerror = () => {
      if (currentAudio === audio) {
        currentAudio = null;
      }
      // Fallback to Web Speech API if API fails
      fallbackWebSpeech(cleanText, onStart, onEnd, onError);
    };

    await audio.play();
  } catch {
    // If Audio.play() throws, fallback to Web Speech API
    fallbackWebSpeech(cleanText, onStart, onEnd, onError);
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
