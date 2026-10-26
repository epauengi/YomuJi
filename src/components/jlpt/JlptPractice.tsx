'use client';

import { Fragment, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowsClockwise, BookOpenText, CaretRight,
  CheckCircle, Clock, Flag, GraduationCap,
  TextAa, Translate, WarningCircle, XCircle,
} from '@phosphor-icons/react';
import { CATEGORIES, remainingSeconds, type Category, type Mode, type Catalog, type Paper, type PaperQuestion, type Grade } from '@/lib/jlpt';

type Session = {
  paper: Paper;
  answers: Record<string, number>;
  flags: string[];
  index: number;
  startedAt: number;
  deadline: number | null;
};

const levels = ['N5', 'N4', 'N3', 'N2', 'N1'];
const sectionIcons = { vocabulary_kanji: Translate, grammar: TextAa, reading: BookOpenText };

function timeText(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}

async function jsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => { throw new Error('Phản hồi không hợp lệ. Vui lòng thử lại.'); });
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Không tải được dữ liệu. Vui lòng thử lại.');
  return data as T;
}

function Countdown({ deadline }: { deadline: number }) {
  const [seconds, setSeconds] = useState(() => remainingSeconds(deadline, Date.now()));
  useEffect(() => {
    const update = () => setSeconds(remainingSeconds(deadline, Date.now()));
    update();
    const timer = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, [deadline]);
  return <span className={`jlpt-timer ${seconds <= 300 ? 'jlpt-time-low' : ''}`} role="timer" aria-label={`Còn ${Math.ceil(seconds / 60)} phút`}><Clock size={19} aria-hidden="true" /><span>{timeText(seconds)}</span></span>;
}

function JapaneseText({ text }: { text: string }) {
  return <>{text.split(/(【[^】]+】)/g).map((part, i) => /^【[^】]+】$/.test(part)
    ? <strong key={i} className="jlpt-focus-word">{part.slice(1, -1)}</strong>
    : <Fragment key={i}>{part}</Fragment>)}</>;
}

function Passage({ question }: { question: PaperQuestion }) {
  if (!question.passage) return null;
  const texts = question.passage.texts ?? [{ label: '', text: question.passage.text ?? '' }];
  return <section className="jlpt-passage" aria-label="Đoạn văn cho câu hỏi">
    <div className="jlpt-passage-label"><BookOpenText size={18} aria-hidden="true" /><span>Đoạn đọc</span></div>
    {texts.map((part, index) => <div key={index} className="jlpt-passage-part">
      {part.label ? <h3 lang="ja">文章 {part.label}</h3> : null}
      <p lang="ja" className="jp-text">{part.text}</p>
    </div>)}
  </section>;
}

export function JlptPractice() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [level, setLevel] = useState('N2');
  const [mode, setMode] = useState<Mode>('practice');
  const [category, setCategory] = useState<Category>('vocabulary_kanji');
  const [session, setSession] = useState<Session | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [busy, setBusy] = useState<number | 'grading' | null>(null);
  const [error, setError] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [expired, setExpired] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [reviewFilter, setReviewFilter] = useState<'all' | 'missed'>('all');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const questionRef = useRef<HTMLElement>(null);
  const focusQuestion = useRef(false);
  const sessionRef = useRef(session);
  const gradeRef = useRef(grade);
  gradeRef.current = grade;
  const finishRef = useRef<(timedOut?: boolean) => void>(() => {});
  const submitting = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    const controller = new AbortController();
    setCatalogError('');
    fetch('/api/jlpt', { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) })
      .then(jsonResponse<Catalog>).then(setCatalog)
      .catch((e: unknown) => { if (!controller.signal.aborted) setCatalogError(e instanceof Error && e.name !== 'TimeoutError' && e.name !== 'TypeError' ? e.message : 'Chưa tải được danh sách đề. Kiểm tra kết nối rồi thử lại.'); });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    if (!session || grade) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const protectNavigation = (event: MouseEvent) => {
      const target = event.target as Element;
      const link = target.closest?.('a[href]');
      if ((!link && !target.closest?.('nav form button')) || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (link?.getAttribute('href')?.startsWith('#')) return;
      if (!window.confirm('Rời bài luyện? Các câu trả lời chưa nộp sẽ không được lưu.')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    const protectSearch = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.isComposing || !(event.target instanceof HTMLInputElement) || !event.target.closest('nav form')) return;
      if (!window.confirm('Rời bài luyện để tra cứu? Các câu trả lời chưa nộp sẽ không được lưu.')) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', protectNavigation, true);
    document.addEventListener('keydown', protectSearch, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', protectNavigation, true);
      document.removeEventListener('keydown', protectSearch, true);
    };
  }, [!!session, !!grade]);

  useEffect(() => {
    if (!session?.deadline || grade) return;
    const deadline = session.deadline;
    const update = () => { if (Date.now() >= deadline) finishRef.current(true); };
    update();
    const interval = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    return () => { window.clearInterval(interval); document.removeEventListener('visibilitychange', update); };
  }, [session?.deadline, !!grade]);

  useEffect(() => {
    const target = focusQuestion.current ? questionRef.current : headingRef.current;
    target?.focus({ preventScroll: true });
    (focusQuestion.current ? questionRef.current : document.getElementById('jlpt-workspace'))?.scrollIntoView({ block: 'start' });
    focusQuestion.current = false;
  }, [session?.paper, session?.index, !!grade]);

  useEffect(() => {
    const protectBack = (event: PopStateEvent) => {
      if (!sessionRef.current || event.state?.jlptSession) return;
      if (!gradeRef.current && !window.confirm('Rời bài luyện? Các câu trả lời chưa nộp sẽ không được lưu.')) {
        window.history.forward();
        return;
      }
      requestRef.current?.abort();
      sessionRef.current = null;
      setSession(null); setGrade(null); setError(''); setBusy(null); setExpired(false); setConfirmSubmit(false);
    };
    window.addEventListener('popstate', protectBack);
    return () => window.removeEventListener('popstate', protectBack);
  }, []);

  const goTo = (index: number) => {
    if (session?.index === index) { questionRef.current?.focus(); return; }
    focusQuestion.current = true;
    setSession((previous) => previous ? { ...previous, index } : previous);
    setConfirmSubmit(false);
  };

  const start = async (number: number, selectedMode = mode, selectedCategory = category) => {
    if (busy !== null) return;
    setBusy(number); setError('');
    const controller = new AbortController();
    requestRef.current?.abort(); requestRef.current = controller;
    try {
      const params = new URLSearchParams({ mode: selectedMode, exam: String(number), ...(selectedMode === 'practice' ? { category: selectedCategory } : {}) });
      const paper = await fetch(`/api/jlpt?${params}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]) }).then(jsonResponse<Paper>);
      const now = Date.now();
      if (!sessionRef.current) window.history.pushState({ ...window.history.state, jlptSession: true }, '');
      setMode(paper.mode); setCategory(paper.questions[0].category);
      setSession({ paper, answers: {}, flags: [], index: 0, startedAt: now, deadline: paper.durationMinutes ? now + paper.durationMinutes * 60000 : null });
      setGrade(null); setExpired(false); setConfirmSubmit(false); setReviewFilter('all'); setElapsed(0);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error && e.name !== 'TimeoutError' && e.name !== 'TypeError' ? e.message : 'Chưa tải được đề. Kiểm tra kết nối rồi chọn lại đề.'); }
    finally { if (!controller.signal.aborted) setBusy(null); }
  };

  const finish = async (timedOut = false) => {
    const current = sessionRef.current;
    if (!current || submitting.current || grade || (timedOut && expired)) return;
    if (timedOut || (current.deadline !== null && Date.now() >= current.deadline)) setExpired(true);
    submitting.current = true;
    setBusy('grading'); setError(''); setConfirmSubmit(false);
    const controller = new AbortController();
    requestRef.current = controller;
    const duration = Math.max(0, Math.floor((Math.min(Date.now(), current.deadline ?? Infinity) - current.startedAt) / 1000));
    setElapsed(duration);
    try {
      const result = await fetch('/api/jlpt', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        body: JSON.stringify({ mode: current.paper.mode, exam: current.paper.number, ...(current.paper.mode === 'practice' ? { category: current.paper.questions[0].category } : {}), answers: current.answers }),
      }).then(jsonResponse<Grade>);
      setGrade(result); setSession((previous) => previous ? { ...previous, index: 0 } : previous);
    } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error && e.name !== 'TimeoutError' && e.name !== 'TypeError' ? e.message : 'Chưa chấm được bài. Kiểm tra kết nối rồi nộp lại.'); }
    finally { submitting.current = false; if (!controller.signal.aborted) setBusy(null); }
  };
  finishRef.current = (timedOut) => { void finish(timedOut); };

  const exit = () => {
    if (!grade && !window.confirm('Thoát bài luyện? Các câu trả lời chưa nộp sẽ không được lưu.')) return;
    requestRef.current?.abort();
    sessionRef.current = null;
    setSession(null); setGrade(null); setError(''); setBusy(null); setExpired(false); setConfirmSubmit(false);
    if (window.history.state?.jlptSession) window.history.back();
  };

  const choose = (id: string, choice: number) => {
    if (grade || busy || expired) return;
    if (session?.deadline && Date.now() >= session.deadline) { void finish(true); return; }
    setSession((previous) => previous ? { ...previous, answers: { ...previous.answers, [id]: choice } } : previous);
  };

  const question = session?.paper.questions[session.index];
  const answered = session ? Object.keys(session.answers).length : 0;
  const total = session?.paper.questions.length ?? 0;
  const currentCategory = CATEGORIES.find((item) => item.id === category)!;
  const currentAnswer = question && grade ? grade.answers[question.id] : null;
  const navigationQuestions = session?.paper.questions.map((q, index) => ({ q, index })).filter(({ q }) => !grade || reviewFilter === 'all' || session.answers[q.id] !== grade.answers[q.id].answer) ?? [];

  return <div className="jlpt-page">
    <div className="jlpt-container" id="jlpt-workspace">
      {!session ? <>
        <header className="jlpt-page-heading">
          <h1 ref={headingRef} tabIndex={-1}>Luyện đề JLPT</h1>
        </header>

        <div className="jlpt-levels" role="group" aria-label="Chọn cấp độ JLPT">
          {levels.map((item) => <button key={item} type="button" className={`jlpt-level ${level === item ? 'is-selected' : ''}`} aria-pressed={level === item} onClick={() => { setLevel(item); setError(''); }}>
            <span>{item}</span>
          </button>)}
        </div>

        {level !== 'N2' ? <section className="jlpt-empty" aria-labelledby="jlpt-empty-heading">
          <GraduationCap aria-hidden="true" size={36} weight="duotone" />
          <h2 id="jlpt-empty-heading">Đề {level} đang được chuẩn bị</h2><p>Hiện có 10 đề N2, chia thành Từ vựng / Kanji, Ngữ pháp và Đọc hiểu.</p>
          <button type="button" className="jlpt-button jlpt-primary" onClick={() => setLevel('N2')}>Luyện N2 <ArrowRight size={18} aria-hidden="true" /></button>
        </section> : <div className="jlpt-catalog-layout">
          <aside className="jlpt-categories" aria-label="Các phần của đề N2">
            <div className="jlpt-category-list">
              {CATEGORIES.map((part) => {
                const Icon = sectionIcons[part.id];
                return <button key={part.id} type="button" aria-pressed={mode === 'practice' && category === part.id} className={`jlpt-category ${mode === 'practice' && category === part.id ? 'is-selected' : ''}`} onClick={() => { setCategory(part.id); setMode('practice'); setError(''); }}>
                  <Icon size={22} aria-hidden="true" /><span><strong>{part.label}</strong></span><CaretRight size={16} aria-hidden="true" />
                </button>;
              })}
            </div>
          </aside>

          <section className="jlpt-exams" aria-labelledby="jlpt-exams-heading" aria-busy={!catalog && !catalogError}>
            <div className="jlpt-mode-switch" role="group" aria-label="Cách luyện">
              <button type="button" aria-pressed={mode === 'practice'} className={mode === 'practice' ? 'is-selected' : ''} onClick={() => { setMode('practice'); setError(''); }}><BookOpenText size={18} aria-hidden="true" />Luyện từng phần</button>
              <button type="button" aria-pressed={mode === 'mock'} className={mode === 'mock' ? 'is-selected' : ''} onClick={() => { setMode('mock'); setError(''); }}><Clock size={18} aria-hidden="true" />Thi thử đủ đề</button>
            </div>
            <div className="jlpt-exams-heading"><h2 id="jlpt-exams-heading">{mode === 'practice' ? currentCategory.label : 'Thi thử N2'}</h2></div>
            <div className="jlpt-exams-meta"><span>10 đề</span><span><Clock size={17} aria-hidden="true" />{mode === 'practice' ? 'Không giới hạn giờ' : '75 câu · 105 phút'}</span></div>
            {mode === 'mock' ? <p className="jlpt-mock-note">Gồm cả ba phần, không gồm nghe.</p> : null}

            {catalogError ? <div className="jlpt-message jlpt-error" role="alert"><WarningCircle size={22} aria-hidden="true" /><div><strong>Chưa tải được danh sách đề</strong><p>{catalogError}</p><button type="button" className="jlpt-text-button" onClick={() => setAttempt((value) => value + 1)}>Thử tải lại</button></div></div>
              : !catalog ? <div className="jlpt-loading" role="status"><ArrowsClockwise aria-hidden="true" size={22} /><p>Đang tải danh sách đề N2…</p></div>
              : <ol className="jlpt-exam-list">{catalog.exams.map((exam) => {
                return <li key={exam.number} className={busy === exam.number ? 'is-loading' : ''}>
                  <div className="jlpt-exam-title"><h3>Đề {String(exam.number).padStart(2, '0')}</h3></div>
                  <button type="button" className="jlpt-button jlpt-row-button" disabled={busy !== null} onClick={() => void start(exam.number)} aria-label={`${mode === 'mock' ? 'Thi thử' : 'Luyện'} đề ${String(exam.number).padStart(2, '0')}${mode === 'practice' ? ` · ${currentCategory.label}` : ''}`}>
                    {busy === exam.number ? 'Đang mở…' : 'Làm bài'}<ArrowRight size={18} aria-hidden="true" />
                  </button>
                </li>;
              })}</ol>}
            {error ? <div className="jlpt-message jlpt-error" role="alert"><WarningCircle size={21} aria-hidden="true" /><p>{error}</p></div> : null}
            <p className="jlpt-source-note">Đề luyện tự biên soạn, không phải đề JLPT chính thức.</p>
          </section>
        </div>}
      </> : <>
        <div className="jlpt-session-top"><button type="button" className="jlpt-back" onClick={exit} disabled={busy === 'grading'}><ArrowLeft size={18} aria-hidden="true" />{grade ? 'Về danh sách đề' : 'Thoát bài luyện'}</button><span className="jlpt-n2-badge">N2</span></div>
        <header className="jlpt-session-heading"><div><h1 ref={headingRef} tabIndex={-1}>{grade ? 'Kết quả luyện đề' : session.paper.title}</h1><p>{grade ? session.paper.title : session.paper.mode === 'mock' ? 'Tự nộp khi hết giờ' : 'Xem đáp án sau khi nộp'}</p></div>{!grade && session.deadline ? <Countdown deadline={session.deadline} /> : null}</header>
        {grade ? <section className="jlpt-result" aria-label="Tổng kết bài làm">
          <div className="jlpt-result-score"><CheckCircle aria-hidden="true" size={32} /><div><strong>{grade.correct}<span> / {grade.total}</span></strong><p>câu trả lời đúng</p></div></div>
          <div className="jlpt-result-detail"><p><span>Sai</span><strong>{grade.incorrect}</strong></p><p><span>Bỏ trống</span><strong>{grade.unanswered}</strong></p><p><span>Thời gian làm</span><strong>{timeText(elapsed)}</strong></p></div>
          {session.paper.mode === 'mock' ? <div className="jlpt-result-sections">{grade.sections.map((part) => <div key={part.category}><span>{part.label}</span><strong>{part.correct} / {part.total}</strong></div>)}</div> : null}
          <p className="jlpt-result-note">{expired ? 'Hết giờ, bài đã tự động nộp. ' : ''}Không quy đổi sang điểm JLPT chính thức.</p>
          <button type="button" className="jlpt-button jlpt-secondary" disabled={busy !== null} onClick={() => void start(session.paper.number, session.paper.mode, session.paper.questions[0].category)}><ArrowsClockwise size={18} aria-hidden="true" />Làm lại đề này</button>
        </section> : <div className="jlpt-progress"><div><span><strong>{answered}</strong> / {total} câu đã trả lời</span>{session.flags.length ? <span>{session.flags.length} câu đánh dấu</span> : null}</div><progress value={answered} max={total} aria-label="Tiến độ trả lời" /></div>}

        {expired && !grade ? <div role="status" className="jlpt-message jlpt-warning"><Clock size={22} aria-hidden="true" /><p>Đã hết 105 phút. Bài làm đã khóa; {busy === 'grading' ? 'đang chấm điểm…' : 'hãy thử nộp lại nếu có lỗi kết nối.'}</p></div> : null}
        {error ? <div role="alert" className="jlpt-message jlpt-error"><WarningCircle size={22} aria-hidden="true" /><div><p>{error}</p><p>{grade ? 'Kết quả bài trước vẫn được giữ.' : 'Các câu trả lời vẫn được giữ trong phiên này.'}</p><button type="button" className="jlpt-text-button" onClick={() => grade ? void start(session.paper.number, session.paper.mode, session.paper.questions[0].category) : void finish()} disabled={busy !== null}>{grade ? 'Thử mở lại đề' : 'Thử nộp lại'}</button></div></div> : null}

        <div className="jlpt-work-layout">
          {question ? <section ref={questionRef} tabIndex={-1} className="jlpt-question" aria-label={`${grade ? 'Xem lại câu' : 'Câu hỏi'} ${session.index + 1} / ${total}`}>
            <div className="jlpt-question-header"><span>{question.categoryLabel} <span aria-hidden="true">/</span> Câu {session.index + 1} / {total}</span>{!grade ? <button type="button" className={`jlpt-flag ${session.flags.includes(question.id) ? 'is-selected' : ''}`} aria-pressed={session.flags.includes(question.id)} onClick={() => setSession((previous) => previous ? { ...previous, flags: previous.flags.includes(question.id) ? previous.flags.filter((id) => id !== question.id) : [...previous.flags, question.id] } : previous)} disabled={busy === 'grading' || expired}><Flag size={18} weight={session.flags.includes(question.id) ? 'fill' : 'regular'} aria-hidden="true" /><span>{session.flags.includes(question.id) ? 'Đã đánh dấu' : 'Đánh dấu'}</span></button> : null}</div>
            <div className="jlpt-question-instruction"><p className="jlpt-problem-title"><span lang="ja">問題 {question.problemNumber}</span><span lang="ja">{question.subtype}</span></p><p lang="ja" className="jp-text">{question.instruction}</p></div>
            <Passage question={question} />
            {question.answer_rule ? <p className="jlpt-answer-rule">{question.answer_rule}</p> : null}
            <fieldset className="jlpt-choices" disabled={!!grade || busy === 'grading' || expired}>
              <legend lang="ja" className="jp-text jlpt-question-text"><JapaneseText text={question.question} /></legend>
              {question.choices.map((choice) => {
                const selected = session.answers[question.id] === choice.id;
                const correct = currentAnswer?.answer === choice.id;
                const incorrect = grade && selected && !correct;
                return <label key={choice.id} className={`jlpt-choice ${selected ? 'is-selected' : ''} ${grade && correct ? 'is-correct' : ''} ${incorrect ? 'is-incorrect' : ''}`}>
                  <input type="radio" name={question.id} value={choice.id} checked={selected} onChange={() => choose(question.id, choice.id)} />
                  <span className="jlpt-choice-number" aria-hidden="true">{choice.id}</span><span lang="ja" className="jp-text">{choice.text}</span>
                  {grade && correct ? <span className="jlpt-choice-state"><CheckCircle size={19} aria-hidden="true" />Đáp án đúng</span> : incorrect ? <span className="jlpt-choice-state"><XCircle size={19} aria-hidden="true" />Bạn chọn</span> : null}
                </label>;
              })}
            </fieldset>
            {grade && currentAnswer ? <div className={`jlpt-review-answer ${session.answers[question.id] === currentAnswer.answer ? 'is-correct' : 'is-incorrect'}`} role="status"><strong>{!session.answers[question.id] ? 'Bạn đã bỏ trống câu này.' : session.answers[question.id] === currentAnswer.answer ? 'Bạn đã trả lời đúng.' : `Bạn chọn ${session.answers[question.id]}.`} Đáp án đúng: {currentAnswer.answer}.</strong>{currentAnswer.completed_sentence ? <p lang="ja" className="jp-text">{currentAnswer.completed_sentence}</p> : null}{currentAnswer.full_order ? <p>Thứ tự đúng: {currentAnswer.full_order.join(' · ')}</p> : null}</div> : null}
            <div className="jlpt-question-actions"><button type="button" className="jlpt-button jlpt-secondary" onClick={() => goTo(session.index - 1)} disabled={session.index === 0}><ArrowLeft size={18} aria-hidden="true" />Câu trước</button><button type="button" className="jlpt-button jlpt-primary" onClick={() => goTo(session.index + 1)} disabled={session.index === total - 1}>Câu tiếp<ArrowRight size={18} aria-hidden="true" /></button></div>
          </section> : null}

          <aside className="jlpt-question-nav" aria-label="Điều hướng câu hỏi">
            <h2>{grade ? 'Xem lại bài làm' : 'Phiếu trả lời'}</h2>
            {grade ? <div className="jlpt-review-filter" role="group" aria-label="Lọc câu xem lại"><button type="button" aria-pressed={reviewFilter === 'all'} onClick={() => setReviewFilter('all')}>Tất cả</button><button type="button" aria-pressed={reviewFilter === 'missed'} onClick={() => { setReviewFilter('missed'); const index = session.paper.questions.findIndex((q) => session.answers[q.id] !== grade.answers[q.id].answer); if (index >= 0) goTo(index); }}>Sai / Bỏ trống</button></div> : null}
            {CATEGORIES.map((part) => {
              const items = navigationQuestions.filter(({ q }) => q.category === part.id);
              if (!items.length) return null;
              return <div className="jlpt-nav-section" key={part.id}>{session.paper.mode === 'mock' ? <h3>{part.label}</h3> : null}<div className="jlpt-question-grid">{items.map(({ q, index }) => {
                const correct = grade && session.answers[q.id] === grade.answers[q.id].answer;
                const status = grade ? correct ? 'Đúng' : session.answers[q.id] ? 'Sai' : 'Bỏ trống' : session.answers[q.id] ? 'Đã trả lời' : 'Chưa trả lời';
                return <button type="button" key={q.id} aria-label={`Câu ${index + 1}: ${status}${session.flags.includes(q.id) ? ', đã đánh dấu' : ''}`} aria-current={session.index === index ? 'step' : undefined} className={`${session.answers[q.id] ? 'is-answered' : ''} ${grade ? correct ? 'is-correct' : 'is-incorrect' : ''}`} onClick={() => goTo(index)}><span>{index + 1}</span>{!grade && session.flags.includes(q.id) ? <Flag size={10} weight="fill" aria-hidden="true" /> : null}</button>;
              })}</div></div>;
            })}
            {grade && !navigationQuestions.length ? <p className="jlpt-all-correct"><CheckCircle size={20} aria-hidden="true" />Không có câu sai hoặc bỏ trống.</p> : null}
            {!grade ? <><div className="jlpt-nav-legend"><span><i className="is-answered" />Đã trả lời</span><span><Flag size={13} aria-hidden="true" />Đánh dấu</span></div>
              <p className="jlpt-submit-note">{total - answered ? `Còn ${total - answered} câu chưa trả lời.` : 'Bạn đã trả lời tất cả câu hỏi.'}</p>
              {confirmSubmit ? <div className="jlpt-confirm" role="group" aria-label="Xác nhận nộp bài"><p>Nộp bài để xem kết quả? Sau khi nộp, bạn không thể đổi đáp án.</p><button autoFocus type="button" className="jlpt-button jlpt-primary" disabled={busy !== null} onClick={() => void finish()}>Xác nhận nộp bài</button><button type="button" className="jlpt-text-button" onClick={() => setConfirmSubmit(false)}>Tiếp tục làm bài</button></div> : <button type="button" className="jlpt-button jlpt-primary jlpt-submit" disabled={busy !== null} onClick={() => expired ? void finish() : setConfirmSubmit(true)}><CheckCircle size={19} aria-hidden="true" />{busy === 'grading' ? 'Đang chấm bài…' : expired ? 'Nộp lại bài' : 'Nộp bài'}</button>}
              <p className="jlpt-session-notice">Rời trang sẽ mất bài đang làm.</p>
            </> : <button type="button" className="jlpt-text-button" onClick={exit}>Chọn đề khác<ArrowRight size={17} aria-hidden="true" /></button>}
          </aside>
        </div>
      </>}
    </div>
  </div>;
}
