'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { buildImportedDeck, plainAnkiText, type AnkiMapping } from '@/lib/ankiImport';
import type { AnkiModel, AnkiPackage } from '@/lib/ankiPackage';
import type { Deck } from '@/lib/flashcards';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const LOAD_TIMEOUT = 60_000;

type WorkerResponse =
  | { ok: true; data: AnkiPackage }
  | { ok: false; error: string };

function suggestedMapping(fields: string[]): AnkiMapping {
  const find = (pattern: RegExp) => fields.findIndex((field) => pattern.test(field.trim()));
  const word = find(/^(front|word|expression|vocabulary|japanese|term|kanji|question|từ|từ vựng|mặt trước)$/i);
  const wordIndex = word < 0 ? 0 : word;
  const readingMatch = find(/^(reading|kana|furigana|yomigana|pronunciation|cách đọc)$/i);
  const reading = readingMatch >= 0 && readingMatch !== wordIndex ? readingMatch : -1;
  const meaningMatch = find(/^(back|meaning|definition|gloss|vietnamese|english|answer|translation|nghĩa|dịch|mặt sau)$/i);
  const meaning = meaningMatch >= 0 && meaningMatch !== wordIndex && meaningMatch !== reading
    ? meaningMatch
    : fields.findIndex((_, index) => index !== wordIndex && index !== reading);

  return { word: wordIndex, reading, meaning };
}

export function AnkiImport({
  onImport,
  disabled,
  onClose,
}: {
  onImport: (deck: Deck) => Promise<boolean>;
  disabled: boolean;
  onClose: () => void;
}) {
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<number | null>(null);
  const aliveRef = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [ankiPackage, setAnkiPackage] = useState<AnkiPackage | null>(null);
  const [modelIndex, setModelIndex] = useState(0);
  const [mapping, setMapping] = useState<AnkiMapping>({ word: -1, reading: -1, meaning: -1 });
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const model = ankiPackage?.models[modelIndex];
  const busy = disabled || saving;
  const fieldsConflict = [mapping.word, mapping.meaning, ...(mapping.reading === -1 ? [] : [mapping.reading])]
    .some((index, position, indices) => index < 0 || indices.indexOf(index) !== position);
  const preview = useMemo(() => {
    if (typeof document === 'undefined' || !model || fieldsConflict) return [];
    return model.notes.slice(0, 3).map((note) => ({
      word: plainAnkiText(note.fields[mapping.word] ?? ''),
      reading: mapping.reading === -1 ? '' : plainAnkiText(note.fields[mapping.reading] ?? ''),
      meaning: plainAnkiText(note.fields[mapping.meaning] ?? ''),
    }));
  }, [fieldsConflict, mapping, model]);

  function stopWorker() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    workerRef.current?.terminate();
    workerRef.current = null;
    setLoading(false);
  }

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0] ?? null;
    event.currentTarget.value = '';
    stopWorker();
    setFile(null);
    setAnkiPackage(null);
    setModelIndex(0);
    setMapping({ word: -1, reading: -1, meaning: -1 });
    setError('');
    if (!selected) return;
    if (!selected.name.toLowerCase().endsWith('.apkg')) {
      setError('Chỉ hỗ trợ tệp .apkg. Hãy chọn lại tệp Anki hợp lệ.');
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError('Tệp vượt quá 50 MiB. Hãy chọn tệp nhỏ hơn.');
      return;
    }

    setFile(selected);
    setName(selected.name.replace(/\.apkg$/i, '').trim().slice(0, 80));
    setLoading(true);
    try {
      const worker = new Worker(new URL('../../lib/anki.worker.ts', import.meta.url), { type: 'module' });
      workerRef.current = worker;
      const finish = () => {
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = null;
        worker.terminate();
        if (workerRef.current === worker) workerRef.current = null;
        setLoading(false);
      };

      worker.onmessage = (message: MessageEvent<WorkerResponse>) => {
        if (workerRef.current !== worker) return;
        finish();
        if (!message.data?.ok) {
          setError(message.data?.error || 'Không đọc được tệp Anki. Hãy kiểm tra tệp rồi thử lại.');
          return;
        }
        const parsed = message.data.data;
        setAnkiPackage(parsed);
        const firstModel = parsed.models[0];
        if (firstModel) setMapping(suggestedMapping(firstModel.fields));
        else setError('Tệp không có loại thẻ nào để nhập. Hãy chọn tệp .apkg khác.');
      };
      worker.onerror = () => {
        if (workerRef.current !== worker) return;
        finish();
        setError('Không thể đọc tệp Anki. Hãy thử tệp khác.');
      };
      timerRef.current = window.setTimeout(() => {
        if (workerRef.current !== worker) return;
        finish();
        setError('Đọc tệp quá lâu. Hãy thử tệp nhỏ hơn.');
      }, LOAD_TIMEOUT);
      worker.postMessage(selected);
    } catch {
      stopWorker();
      setError('Không thể khởi động trình đọc Anki trong trình duyệt này.');
    }
  }

  function changeModel(value: string) {
    const nextIndex = Number(value);
    setModelIndex(nextIndex);
    const nextModel = ankiPackage?.models[nextIndex];
    if (nextModel) setMapping(suggestedMapping(nextModel.fields));
    setError('');
  }

  function changeMapping(key: keyof AnkiMapping, value: string) {
    setMapping((current) => ({ ...current, [key]: Number(value) }));
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!model || fieldsConflict || busy) return;
    setError('');
    setSaving(true);
    try {
      const deck = buildImportedDeck(model, mapping, name);
      const imported = await onImport(deck);
      if (aliveRef.current && !imported) setError('Chưa lưu được bộ thẻ. Dữ liệu vẫn được giữ ở đây để bạn thử lại.');
    } catch (cause) {
      if (aliveRef.current) setError(cause instanceof Error ? cause.message : 'Không thể tạo bộ thẻ từ tệp này.');
    } finally {
      if (aliveRef.current) setSaving(false);
    }
  }

  const selectedNotes = model?.notes.length ?? 0;

  return (
    <section id="fc-import" className="fc-form" aria-labelledby="fc-import-title">
      <div className="fc-heading-row">
        <h2 id="fc-import-title">Nhập bộ thẻ Anki</h2>
        <button className="fc-button" type="button" disabled={busy} onClick={onClose}>Đóng</button>
      </div>
      <p className="fc-import-notice fc-muted">Tệp được xử lý ngay trên thiết bị này. Chỉ nhập nội dung chữ thành một bộ thẻ mới; không nhập hình ảnh, mẫu thẻ hay lịch ôn. Cloze không được hỗ trợ.</p>

      {error && <p className="fc-error" role="alert">{error}</p>}
      <p className="fc-status" role="status" aria-live="polite">{loading ? 'Đang đọc tệp trên thiết bị này…' : ''}</p>

      <label>
        <span>Tệp Anki (.apkg, tối đa 50 MiB)</span>
        <input className="fc-import-file" type="file" accept=".apkg,application/octet-stream" onChange={selectFile} disabled={busy} />
      </label>

      {file && <p className="fc-muted">Đã chọn: {file.name}</p>}
      {ankiPackage && model && <form onSubmit={submit}>
        <p className="fc-muted">Tệp có {ankiPackage.noteCount.toLocaleString('vi-VN')} ghi chú. Mỗi lần nhập chỉ tạo một bộ thẻ từ một loại thẻ.</p>

        <label>
          <span>Loại thẻ · {model.notes.length.toLocaleString('vi-VN')} ghi chú</span>
          <select value={modelIndex} onChange={(event) => changeModel(event.target.value)} disabled={busy}>
            {ankiPackage.models.map((item: AnkiModel, index) => <option key={`${item.id}-${index}`} value={index}>{item.name || `Loại thẻ ${index + 1}`}</option>)}
          </select>
        </label>

        <label>
          <span>Tên bộ thẻ</span>
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required disabled={busy} />
        </label>

        <div className="fc-form-columns">
          {([
            ['word', 'Từ tiếng Nhật'],
            ['reading', 'Cách đọc (không bắt buộc)'],
            ['meaning', 'Nghĩa'],
          ] as const).map(([key, label]) => <label key={key}>
            <span>{label}</span>
            <select value={mapping[key]} onChange={(event) => changeMapping(key, event.target.value)} disabled={busy}>
              {key === 'reading' && <option value={-1}>Không nhập cách đọc</option>}
              {model.fields.map((field, index) => <option key={index} value={index}>{field || `Trường ${index + 1}`}</option>)}
            </select>
          </label>)}
        </div>

        {fieldsConflict && <p className="fc-error" role="alert">Chọn trường khác nhau cho từ và nghĩa; cách đọc cũng cần trường riêng nếu được nhập.</p>}

        <div className="fc-import-preview">
          <table>
            <caption className="fc-muted">Xem trước · tối đa 3 trong {selectedNotes.toLocaleString('vi-VN')} thẻ</caption>
            <thead><tr><th scope="col">Từ tiếng Nhật</th>{mapping.reading !== -1 && <th scope="col">Cách đọc</th>}<th scope="col">Nghĩa</th></tr></thead>
            <tbody>{preview.length ? preview.map((card, index) => <tr key={index}>
              <td lang="ja">{card.word || '(trống)'}</td>
              {mapping.reading !== -1 && <td lang="ja">{card.reading || '(trống)'}</td>}
              <td>{card.meaning || '(trống)'}</td>
            </tr>) : <tr><td colSpan={mapping.reading === -1 ? 2 : 3} className="fc-muted">Chưa có ghi chú để xem trước.</td></tr>}</tbody>
          </table>
        </div>

        <p className="fc-import-notice">Toàn bộ {selectedNotes.toLocaleString('vi-VN')} thẻ sẽ được thêm mới và đến hạn ngay. Nhập lại không tự gộp thẻ trùng với bộ hiện có.</p>
        <div className="fc-actions">
          <button className="fc-button fc-primary" type="submit" disabled={busy || loading || !selectedNotes || fieldsConflict}>
            {saving ? 'Đang lưu…' : `Tạo bộ thẻ · ${selectedNotes.toLocaleString('vi-VN')} thẻ`}
          </button>
          <button className="fc-button" type="button" onClick={onClose} disabled={busy}>Hủy</button>
        </div>
      </form>}
    </section>
  );
}
