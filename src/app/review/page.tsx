'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowsClockwise, Check, SpeakerHigh, Stop } from '@phosphor-icons/react';
import {
  readBookmarks,
  readBookmarkStorageAvailable,
  subscribeToBookmarks,
  type SavedBookmark,
} from '@/lib/browserState';
import { reviewReducer, reviewWords } from '@/lib/reviewSession';
import { playJapaneseAudio, stopCurrentAudio } from '@/lib/tts';

export default function ReviewPage() {
  const [entries, setEntries] = useState<SavedBookmark[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [session, dispatch] = useReducer(reviewReducer, null);
  const [audioStatus, setAudioStatus] = useState<'idle' | 'playing' | 'error'>('idle');
  const audioRun = useRef(0);
  const revealRef = useRef<HTMLButtonElement>(null);
  const missedRef = useRef<HTMLButtonElement>(null);
  const completeRef = useRef<HTMLHeadingElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);

  const eligibleCount = reviewWords(entries).length;
  const excludedCount = entries.length - eligibleCount;
  const currentWord = session?.words[session.index];
  const complete = !!session && !currentWord;

  useEffect(() => {
    const update = () => {
      setEntries(readBookmarks());
      setStorageAvailable(readBookmarkStorageAvailable());
      setHydrated(true);
    };
    update();
    return subscribeToBookmarks(update);
  }, []);

  useEffect(() => {
    if (!session) return;
    if (complete) completeRef.current?.focus();
    else if (session.revealed) missedRef.current?.focus();
    else revealRef.current?.focus();
  }, [session?.index, session?.revealed, complete, !!session]);

  useEffect(() => () => {
    audioRun.current++;
    stopCurrentAudio();
  }, []);

  const send = (action: Parameters<typeof reviewReducer>[1]) => {
    audioRun.current++;
    stopCurrentAudio();
    setAudioStatus('idle');
    dispatch(action);
  };

  const playAudio = () => {
    if (!currentWord) return;
    const run = ++audioRun.current;
    if (audioStatus === 'playing') {
      stopCurrentAudio();
      setAudioStatus('idle');
      return;
    }
    setAudioStatus('playing');
    void playJapaneseAudio(currentWord.reading, {
      onStart: () => {
        if (run === audioRun.current) setAudioStatus('playing');
      },
      onEnd: () => {
        if (run === audioRun.current) setAudioStatus((status) => status === 'error' ? status : 'idle');
      },
      onError: () => {
        if (run === audioRun.current) setAudioStatus('error');
      },
    });
  };

  return (
    <div className="min-h-[75vh] bg-[var(--color-bg)] pb-24">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
        <Link href="/saved" className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-[var(--color-primary-700)] hover:underline underline-offset-4">
          <ArrowLeft aria-hidden="true" size={18} />
          Về mục đã lưu
        </Link>
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-[-0.03em] text-[var(--color-text-primary)] sm:text-4xl">Ôn nhanh từ đã lưu</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">Tự nhớ cách đọc và nghĩa trước khi mở đáp án.</p>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">Kết quả chỉ trong phiên này; tải lại hoặc rời trang sẽ mất kết quả. Không thay đổi mục đã lưu.</p>
        </header>

        {!storageAvailable && (
          <p role="status" className="mb-6 rounded-xl bg-[var(--color-warning-bg)] p-4 text-sm leading-6 text-[var(--color-warning-700)]">
            Không thể đọc đầy đủ bộ nhớ trình duyệt. Dữ liệu gốc được giữ nguyên; bạn vẫn có thể ôn các từ đã đọc được. Hãy cho phép lưu trữ rồi tải lại trang.
          </p>
        )}

        {!hydrated ? (
          <p role="status" className="py-8 text-[var(--color-text-secondary)]">Đang tải từ đã lưu…</p>
        ) : !session ? (
          <section aria-labelledby="review-start" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
            <h2 id="review-start" className="text-xl font-semibold text-[var(--color-text-primary)]">
              {eligibleCount ? `${eligibleCount} từ sẵn sàng để ôn` : 'Chưa có từ phù hợp để ôn'}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
              {eligibleCount
                ? `Phiên này gồm ${Math.min(eligibleCount, 10)} từ được lưu gần đây nhất. Mở đáp án, tự đánh giá, rồi ôn lại những từ chưa nhớ.`
                : 'Lưu từ vựng có cách đọc và nghĩa từ kết quả tra cứu để bắt đầu.'}
            </p>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">
              Chỉ ôn từ vựng; chưa gồm Kanji hoặc mục lưu cũ.
              {excludedCount > 0 && ` ${excludedCount} mục không đủ điều kiện được bỏ qua.`}
            </p>
            {eligibleCount > 0 ? (
              <button ref={startRef} type="button" onClick={() => send({ type: 'start', entries })} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-action-primary)] px-5 py-3 font-semibold text-white hover:bg-[var(--color-action-primary-hover)]">
                <ArrowsClockwise aria-hidden="true" size={20} />
                Bắt đầu ôn ({Math.min(eligibleCount, 10)} từ)
              </button>
            ) : (
              <Link href="/" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-[var(--color-action-primary)] px-5 py-3 font-semibold text-white hover:bg-[var(--color-action-primary-hover)]">Tra và lưu từ</Link>
            )}
          </section>
        ) : complete ? (
          <section aria-labelledby="review-complete" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
            <h2 ref={completeRef} tabIndex={-1} id="review-complete" className="rounded text-2xl font-semibold text-[var(--color-text-primary)]">Đã ôn xong {session.words.length} từ</h2>
            <p className="mt-3 text-sm leading-6 text-[var(--color-text-secondary)]">Đây là kết quả tự đánh giá, không phải điểm kiểm tra.</p>
            <dl className="my-6 divide-y divide-[var(--color-border-subtle)] border-y border-[var(--color-border-subtle)]">
              <div className="flex items-center justify-between gap-4 py-4">
                <dt className="text-[var(--color-text-secondary)]">Đã nhớ</dt>
                <dd className="text-2xl font-semibold tabular-nums text-[var(--color-success-700)]">{session.words.length - session.missed.length}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 py-4">
                <dt className="text-[var(--color-text-secondary)]">Chưa nhớ</dt>
                <dd className="text-2xl font-semibold tabular-nums text-[var(--color-warning-700)]">{session.missed.length}</dd>
              </div>
            </dl>
            {session.missed.length > 0 ? (
              <button type="button" onClick={() => send({ type: 'retry' })} className="min-h-12 w-full rounded-xl bg-[var(--color-action-primary)] px-5 py-3 font-semibold text-white hover:bg-[var(--color-action-primary-hover)]">Ôn lại {session.missed.length} từ chưa nhớ</button>
            ) : (
              <p className="mb-4 text-[var(--color-success-700)]">Bạn đã tự đánh giá nhớ tất cả từ trong lượt này.</p>
            )}
            <Link href="/saved" className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-[var(--color-border)] px-5 py-2 font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]">Về mục đã lưu</Link>
          </section>
        ) : currentWord ? (
          <>
            <div className="mb-5">
              <p role="status" className="mb-2 flex items-center justify-between gap-3 text-sm tabular-nums text-[var(--color-text-secondary)]">
                <span>Từ {session.index + 1} / {session.words.length}</span>
                <span>{session.index} từ đã ôn</span>
              </p>
              <progress aria-label="Số từ đã ôn" value={session.index} max={session.words.length} className="block h-2 w-full accent-[var(--color-primary-600)]" />
            </div>
            <section aria-label="Thẻ ôn tập" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-center sm:p-10">
              <h2 lang="ja" className="jp-text break-words text-4xl font-semibold leading-relaxed text-[var(--color-text-primary)] sm:text-5xl">{currentWord.surface}</h2>
              {!session.revealed ? (
                <>
                  <p className="mt-4 text-sm text-[var(--color-text-secondary)]">Bạn nhớ cách đọc và nghĩa của từ này chứ?</p>
                  <button ref={revealRef} type="button" onClick={() => send({ type: 'reveal' })} className="mt-8 min-h-12 w-full rounded-xl bg-[var(--color-action-primary)] px-5 py-3 font-semibold text-white hover:bg-[var(--color-action-primary-hover)]">Hiện đáp án</button>
                </>
              ) : (
                <div className="mt-4">
                  <p lang="ja" className="jp-text break-words text-xl text-[var(--color-primary-700)]">{currentWord.reading}</p>
                  <p className="mt-5 break-words text-lg leading-8 text-[var(--color-text-primary)]">{currentWord.meanings.join(' · ')}</p>
                  <button type="button" onClick={playAudio} aria-pressed={audioStatus === 'playing'} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-primary-700)] hover:bg-[var(--color-primary-50)]">
                    {audioStatus === 'playing' ? <Stop aria-hidden="true" size={18} /> : <SpeakerHigh aria-hidden="true" size={18} />}
                    {audioStatus === 'playing' ? 'Dừng phát âm' : audioStatus === 'error' ? 'Thử phát âm lại' : 'Nghe phát âm'}
                  </button>
                  {audioStatus === 'error' && <p role="status" className="mt-3 text-sm text-[var(--color-warning-700)]">Chưa phát được âm thanh. Bạn có thể thử lại hoặc tiếp tục ôn.</p>}
                </div>
              )}
            </section>
            {session.revealed && (
              <div className="mt-5 grid grid-cols-2 gap-3">
                <button ref={missedRef} type="button" onClick={() => send({ type: 'answer', remembered: false })} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-warning-bg)] px-3 py-3 font-semibold text-[var(--color-warning-700)] hover:underline underline-offset-4">
                  <ArrowsClockwise aria-hidden="true" size={20} />Chưa nhớ
                </button>
                <button type="button" onClick={() => send({ type: 'answer', remembered: true })} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-success-bg)] px-3 py-3 font-semibold text-[var(--color-success-700)] hover:underline underline-offset-4">
                  <Check aria-hidden="true" size={20} />Đã nhớ
                </button>
              </div>
            )}
            <button type="button" onClick={() => { send({ type: 'exit' }); requestAnimationFrame(() => startRef.current?.focus()); }} className="mt-5 min-h-11 w-full rounded-xl px-4 text-sm text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]">Thoát phiên ôn</button>
          </>
        ) : null}
      </div>
    </div>
  );
}
