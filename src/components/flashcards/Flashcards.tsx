'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const AnkiImport = dynamic(() => import('./AnkiImport').then((module) => module.AnkiImport), { loading: () => <p role="status">Đang mở trình nhập Anki…</p> });
import { ArrowLeft, ArrowRight, BookBookmark, Check, Plus, SpeakerHigh, Trash, X } from '@phosphor-icons/react';
import { loadFlashcards, saveFlashcards, gradeCard, toAnkiTsv, STORAGE_KEY, type Deck, type Flashcard, type FlashcardData } from '@/lib/flashcards';
import { playJapaneseAudio, stopCurrentAudio } from '@/lib/tts';
import { wordHref } from '@/lib/wordRoutes';

type Session = { cards: Flashcard[]; index: number; remembered: number; missed: Flashcard[] };
const message = (error: unknown) => error instanceof Error ? error.message : 'Không thể lưu dữ liệu. Hãy kiểm tra bộ nhớ trình duyệt rồi thử lại.';

export function Flashcards({ deckId }: { deckId?: string }) {
  const [data, setData] = useState<FlashcardData | null>(null);
  const raw = useRef<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [blocked, setBlocked] = useState(false);
  const saving = useRef(false);
  const [pending, setPending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const [now, setNow] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [exportMeanings, setExportMeanings] = useState(false);
  const focusRef = useRef<HTMLButtonElement>(null);
  const summaryRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    try {
      const loaded = loadFlashcards();
      raw.current = loaded.raw;
      setData(loaded.data);
      setNow(Date.now());
    } catch (cause) {
      setError(message(cause));
      setBlocked(true);
    }
    const changed = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === null) {
        setBlocked(true);
        setError('Dữ liệu đã thay đổi ở tab khác. Tải lại trang trước khi tiếp tục; nội dung chưa lưu sẽ mất.');
      }
    };
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    window.addEventListener('storage', changed);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('storage', changed);
      stopCurrentAudio();
    };
  }, []);

  const complete = session !== null && session.index >= session.cards.length;
  useEffect(() => {
    if (session) {
      if (complete) summaryRef.current?.focus();
      else focusRef.current?.focus();
    }
  }, [session, revealed, complete]);

  async function commit(next: FlashcardData) {
    if (blocked || saving.current) return false;
    saving.current = true;
    setPending(true);
    try {
      raw.current = await saveFlashcards(next, raw.current);
      setData(next);
      setError('');
      setNotice('Đã lưu trên trình duyệt này.');
      return true;
    } catch (cause) {
      setError(message(cause));
      return false;
    } finally {
      saving.current = false;
      setPending(false);
    }
  }

  const deck = data?.decks.find((item) => item.id === deckId);
  const deckName = deck?.name;
  useEffect(() => {
    if (!deckName) return;
    const previous = document.title;
    const title = `${deckName} | YomuJi`;
    document.title = title;
    return () => { if (document.title === title) document.title = previous; };
  }, [deckName]);

  const visibleDecks = data?.decks.filter((item) => !(item.sample && item.cards.length === 0)) ?? [];
  const cards = visibleDecks.flatMap((item) => item.cards);
  const due = (items: Flashcard[]) => items.filter((card) => card.dueAt <= now);

  async function createDeck(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const name = String(values.get('name') ?? '').trim();
    if (!name) {
      setError('Tên bộ thẻ không được chỉ chứa khoảng trắng.');
      return;
    }
    const next: Deck = { id: crypto.randomUUID(), name, description: String(values.get('description') ?? '').trim(), sample: false, cards: [] };
    if (await commit({ ...data, decks: [...data.decks, next] })) {
      form.reset();
      setCreating(false);
    }
  }

  async function addCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!data || !deck) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const word = String(values.get('word') ?? '').trim();
    const reading = String(values.get('reading') ?? '').trim();
    const meaning = String(values.get('meaning') ?? '').trim();
    if (!word || !meaning) {
      setError('Nhập từ tiếng Nhật và nghĩa tiếng Việt; không chỉ dùng khoảng trắng.');
      return;
    }
    const card: Flashcard = { id: crypto.randomUUID(), word, reading, meaning, dueAt: 0, reviewedAt: null, known: null };
    if (await commit({ ...data, decks: data.decks.map((item) => item.id === deck.id ? { ...item, cards: [...item.cards, card] } : item) })) {
      form.reset();
      form.querySelector<HTMLInputElement>('input')?.focus();
    }
  }

  function removeCard(card: Flashcard) {
    if (!data || !deck || !window.confirm(`Xóa thẻ “${card.word}”? Không thể hoàn tác.`)) return;
    commit({ ...data, decks: data.decks.map((item) => item.id === deck.id ? { ...item, cards: item.cards.filter((word) => word.id !== card.id) } : item) });
  }

  function start(items: Flashcard[]) {
    if (!items.length || blocked) return;
    stopCurrentAudio();
    setSession({ cards: items.map((card) => ({ ...card })), index: 0, remembered: 0, missed: [] });
    setRevealed(false);
    setNotice('');
    setError('');
  }

  async function answer(known: boolean) {
    if (!data || !deck || !session || !revealed || complete) return;
    const card = session.cards[session.index];
    const timestamp = Date.now();
    const updated = gradeCard(card, known, timestamp);
    if (!await commit({ ...data, decks: data.decks.map((item) => item.id === deck.id ? { ...item, cards: item.cards.map((entry) => entry.id === card.id ? updated : entry) } : item) })) return;
    stopCurrentAudio();
    setNow(timestamp);
    setSession({ ...session, index: session.index + 1, remembered: session.remembered + Number(known), missed: known ? session.missed : [...session.missed, updated] });
    setRevealed(false);
  }

  function exit() {
    stopCurrentAudio();
    setSession(null);
    setRevealed(false);
  }

  function exportAnki(target: Deck) {
    const url = URL.createObjectURL(new Blob([toAnkiTsv(target, window.location.origin, exportMeanings)], { type: 'text/tab-separated-values;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${target.name.replace(/[\\/:*?"<>|]+/gu, '_')}.tsv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setNotice(`Đã xuất ${target.cards.length} thẻ. Trong Anki chọn File › Import và chọn tệp .tsv.`);
  }

  return (
    <div className="flashcards-page">
      <div className={`fc-container ${session ? 'fc-focused' : ''}`}>
        <header className="fc-header">
          {deckId && !session && <Link className="fc-back" href="/flashcards"><ArrowLeft aria-hidden="true" size={18} /> Tất cả bộ thẻ</Link>}
          <div className="fc-heading-row">
            <h1>{session ? 'Ôn thẻ từ' : deckId ? deck?.name ?? 'Bộ thẻ' : 'Flashcards'}</h1>
            {!deckId && data && <div className="fc-actions"><button className="fc-button" disabled={blocked || pending} onClick={() => { setImporting(!importing); setCreating(false); }} aria-expanded={importing} aria-controls="fc-import">Nhập Anki (.apkg)</button><button className="fc-button fc-primary" disabled={pending} onClick={() => { setCreating(!creating); setImporting(false); }} aria-expanded={creating} aria-controls="fc-create"><Plus size={18} aria-hidden="true" /> Tạo bộ thẻ</button></div>}
          </div>
          <p className="fc-muted">{session ? deck?.name : 'Bộ thẻ và tiến độ chỉ lưu trên trình duyệt này, không đồng bộ tài khoản.'}</p>
          {!session && !deckId && (
            <p className="fc-muted">
              Nhớ → ôn lại sau 24 giờ; chưa nhớ → lặp lại sau 10 phút. Bạn cũng có thể thêm từ từ trang <Link href="/saved" className="underline underline-offset-4 hover:text-[var(--color-text-primary)]">Đã lưu</Link> vào bộ thẻ riêng.
            </p>
          )}
        </header>

        {error && <div role="alert" className="fc-error"><p>{error}</p><button className="fc-button" onClick={() => window.location.reload()}>Tải lại trang</button></div>}
        <p role="status" className="fc-status">{notice}</p>
        {!data ? <p role="status">{blocked ? 'Không thể mở bộ thẻ. Dữ liệu gốc được giữ nguyên; không có thay đổi nào được ghi.' : 'Đang tải bộ thẻ…'}</p> : deckId && !deck ? (
          <section className="fc-empty"><BookBookmark size={36} aria-hidden="true" /><h2>Không tìm thấy bộ thẻ</h2><p>Bộ thẻ có thể đã bị xóa hoặc được tạo trên trình duyệt khác.</p><Link className="fc-button" href="/flashcards">Về danh sách bộ thẻ</Link></section>
        ) : !deckId ? (
          <>
            {importing && <AnkiImport disabled={blocked || pending} onClose={() => setImporting(false)} onImport={async (imported) => {
              if (data.decks.length >= 100 || cards.length + imported.cards.length > 10_000) {
                setError('Không thể nhập: giới hạn 100 bộ thẻ và tổng 10.000 thẻ trên thiết bị. Hãy xóa bớt dữ liệu trước.');
                return false;
              }
              if (!await commit({ ...data, decks: [...data.decks, imported] })) return false;
              setImporting(false);
              setNotice(`Đã nhập ${imported.cards.length} thẻ vào bộ “${imported.name}” trên trình duyệt này.`);
              return true;
            }} />}
            {creating && <form id="fc-create" className="fc-form" onSubmit={createDeck}>
              <h2>Tạo bộ thẻ mới</h2>
              <label>Tên bộ thẻ<input name="name" required maxLength={80} autoFocus placeholder="Ví dụ: Từ mới tuần này" /></label>
              <label>Mô tả <span className="fc-muted">(không bắt buộc)</span><textarea name="description" maxLength={300} rows={2} /></label>
              <div className="fc-actions"><button className="fc-button fc-primary" disabled={blocked || pending}>Tạo bộ thẻ</button><button type="button" className="fc-button" onClick={() => setCreating(false)}>Hủy</button></div>
            </form>}
            <div className="fc-list-heading"><h2>Bộ thẻ của bạn</h2><span className="fc-muted">{visibleDecks.length} bộ · {cards.length} thẻ · {due(cards).length} đến hạn</span></div>
            {visibleDecks.length ? <ul className="fc-decks">{visibleDecks.map((item) => <li key={item.id}>
              <Link className="fc-deck" href={`/flashcards/deck/${encodeURIComponent(item.id)}`}>
                <BookBookmark size={26} className="fc-deck-icon" aria-hidden="true" />
                <div className="fc-deck-copy"><div className="fc-deck-title"><h3>{item.name}</h3>{item.sample && <span className="fc-badge">Bộ mẫu</span>}</div><p className="fc-muted">{item.description || 'Bộ thẻ cá nhân'}</p><p className="fc-deck-count">{item.cards.length} thẻ <span className={due(item.cards).length ? 'fc-due' : 'fc-muted'}>· {due(item.cards).length} đến hạn</span></p></div>
                <ArrowRight size={20} aria-hidden="true" />
              </Link>
            </li>)}</ul> : <div className="fc-empty"><h3>Chưa có bộ thẻ</h3><p>Tạo một bộ thẻ, thêm từ tiếng Nhật bạn muốn ghi nhớ.</p><button className="fc-button fc-primary" onClick={() => setCreating(true)}>Tạo bộ thẻ đầu tiên</button></div>}
            <p className="fc-footnote">Xóa dữ liệu trình duyệt sẽ xóa bộ thẻ và tiến độ. Bộ mẫu là nội dung minh họa; bạn có thể học hoặc xóa.</p>
          </>
        ) : deck && session ? complete ? (
          <section className="fc-summary">
            <Check aria-hidden="true" size={40} className="fc-deck-icon" />
            <h2 ref={summaryRef} tabIndex={-1}>Đã hoàn thành phiên học</h2>
            <p>Bạn nhớ {session.remembered} / {session.cards.length} thẻ.</p>
            <p className="fc-muted">Kết quả đã lưu trên trình duyệt này. Thẻ đã nhớ ôn sau 1 ngày; thẻ chưa nhớ ôn sau 10 phút.</p>
            <div className="fc-actions">{session.missed.length > 0 && <button className="fc-button fc-primary" disabled={blocked || pending} onClick={() => start(session.missed)}>Ôn lại {session.missed.length} thẻ chưa nhớ</button>}<button className="fc-button" onClick={exit}>Về bộ thẻ</button></div>
          </section>
        ) : (
          <section aria-label="Phiên học">
            <div className="fc-study-top"><span>Thẻ {session.index + 1} / {session.cards.length}</span><button className="fc-button" disabled={pending} onClick={exit}>Kết thúc phiên</button></div>
            <progress className="fc-progress" aria-label="Số thẻ đã trả lời" value={session.index} max={session.cards.length} />
            <div className="fc-study-card">
              <p className="fc-muted">{revealed ? 'Đối chiếu với câu trả lời của bạn' : 'Bạn còn nhớ nghĩa của từ này?'}</p>
              <h2 lang="ja" className="jp-text fc-word">{session.cards[session.index].word}</h2>
              {revealed && <div className="fc-answer"><p lang="ja" className="jp-text fc-reading">{session.cards[session.index].reading}</p><p className="fc-meaning">{session.cards[session.index].meaning}</p>{session.cards[session.index].sentence && <blockquote className="fc-sentence"><p lang="ja" className="jp-text">{session.cards[session.index].sentence}</p>{session.cards[session.index].source && <Link href={session.cards[session.index].source!.href} className="fc-source">Nguồn: <span lang="ja">{session.cards[session.index].source!.title}</span></Link>}</blockquote>}</div>}
              <button type="button" className="fc-button fc-audio" onClick={() => void playJapaneseAudio(session.cards[session.index].word, { onError: () => setError('Không phát được âm thanh. Kiểm tra kết nối hoặc giọng đọc trên thiết bị rồi thử lại.') })}><SpeakerHigh size={20} aria-hidden="true" /> Nghe phát âm</button>
            </div>
            {revealed ? <div className="fc-grades"><button ref={focusRef} className="fc-button" disabled={blocked || pending} onClick={() => answer(false)}><X size={20} aria-hidden="true" /> Chưa nhớ <small>Ôn sau 10 phút</small></button><button className="fc-button fc-primary" disabled={blocked || pending} onClick={() => answer(true)}><Check size={20} aria-hidden="true" /> Đã nhớ <small>Ôn sau 1 ngày</small></button></div> : <button ref={focusRef} className="fc-button fc-primary fc-reveal" onClick={() => setRevealed(true)}>Xem đáp án</button>}
            <p className="fc-footnote">Tự trả lời trước khi xem đáp án. Tiến độ được lưu sau mỗi lần đánh giá.</p>
          </section>
        ) : deck ? (
          <>
            {deck.sample && <p className="fc-sample">Bộ mẫu minh họa. Tiến độ học của bạn vẫn được lưu trên thiết bị.</p>}
            {deck.description && <p className="fc-description">{deck.description}</p>}
            <div className="fc-deck-toolbar"><div><strong>{deck.cards.length} thẻ</strong><span className="fc-due"> · {due(deck.cards).length} đến hạn</span></div><div className="fc-actions"><button className="fc-button fc-primary" disabled={!due(deck.cards).length || blocked || pending} onClick={() => start(due(deck.cards))}>Ôn thẻ đến hạn ({due(deck.cards).length})</button><button className="fc-button" disabled={!deck.cards.length || blocked || pending} onClick={() => start(deck.cards)}>Học tất cả</button><button className="fc-button" disabled={!deck.cards.length} onClick={() => exportAnki(deck)}>Xuất Anki (TSV)</button></div></div>
            {deck.cards.some((card) => card.source) && <label className="fc-muted"><input type="checkbox" checked={exportMeanings} onChange={(event) => setExportMeanings(event.target.checked)} /> Xuất cả nghĩa lấy từ từ điển. Bản dịch Omoha chưa xác minh giấy phép; chỉ dùng cho học cá nhân, không chia sẻ lại.</label>}
            {deck.cards.length > 0 && due(deck.cards).length === 0 && <p className="fc-muted">Đã ôn hết thẻ đến hạn. Bạn có thể học lại toàn bộ bất cứ lúc nào.</p>}
            <div className="fc-list-heading"><h2>Danh sách từ</h2><button className="fc-button" onClick={() => setAdding(!adding)} aria-expanded={adding} aria-controls="fc-add"><Plus size={18} aria-hidden="true" /> Thêm thẻ</button></div>
            {adding && <form id="fc-add" className="fc-form" onSubmit={addCard}><h3>Thêm từ mới</h3><div className="fc-form-columns"><label>Từ tiếng Nhật<input name="word" lang="ja" required maxLength={100} autoFocus /></label><label>Cách đọc <span className="fc-muted">(không bắt buộc)</span><input name="reading" lang="ja" maxLength={200} /></label></div><label>Nghĩa tiếng Việt<textarea name="meaning" required maxLength={1000} rows={2} /></label><div className="fc-actions"><button className="fc-button fc-primary" disabled={blocked || pending}>Lưu thẻ</button><button type="button" className="fc-button" onClick={() => setAdding(false)}>Đóng</button></div></form>}
            {deck.cards.length > 0 && <label className="fc-search">Tìm trong bộ thẻ<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Từ, cách đọc hoặc nghĩa…" /></label>}
            {deck.cards.length ? <ul className="fc-words">{deck.cards.filter((card) => [card.word, card.reading, card.meaning].join(' ').toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))).map((card) => <li key={card.id}><div className="fc-word-copy"><Link href={wordHref(card.word)} lang="ja" className="jp-text fc-list-word">{card.word}</Link><span lang="ja" className="jp-text fc-muted">{card.reading}</span><p>{card.meaning}</p>{card.sentence && <p lang="ja" className="jp-text fc-muted">{card.sentence}{card.source && <> · <Link href={card.source.href} className="fc-source"><span lang="ja">{card.source.title}</span></Link></>}</p>}<small className={card.dueAt <= now ? 'fc-due' : 'fc-muted'}>{card.dueAt <= now ? 'Đến hạn ôn' : `Ôn tiếp: ${new Date(card.dueAt).toLocaleString('vi-VN')}`}</small></div><button className="fc-button fc-icon-button" disabled={blocked || pending} onClick={() => removeCard(card)} aria-label={`Xóa thẻ ${card.word}`}><Trash size={18} aria-hidden="true" /></button></li>)}{query.trim() && !deck.cards.some((card) => [card.word, card.reading, card.meaning].join(' ').toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))) && <li className="fc-muted">Không tìm thấy từ phù hợp. Thử từ khóa khác.</li>}</ul> : <div className="fc-empty"><h3>Bộ thẻ chưa có từ nào</h3><p>Thêm từ tiếng Nhật và nghĩa tiếng Việt để bắt đầu học.</p><button className="fc-button fc-primary" onClick={() => setAdding(true)}>Thêm thẻ đầu tiên</button></div>}
            <div className="fc-delete-deck"><button className="fc-button fc-danger" disabled={blocked || pending} onClick={async () => {
              if (!window.confirm(`Xóa bộ thẻ “${deck.name}” và toàn bộ ${deck.cards.length} thẻ? Không thể hoàn tác.`)) return;
              if (await commit({ ...data, decks: data.decks.filter((item) => item.id !== deck.id) })) window.location.assign('/flashcards');
            }}><Trash size={18} aria-hidden="true" /> Xóa bộ thẻ</button></div>
          </>
        ) : null}
      </div>
    </div>
  );
}
