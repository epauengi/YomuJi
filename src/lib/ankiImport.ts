import type { AnkiModel } from './ankiPackage';
import type { Deck } from './flashcards';

export type AnkiMapping = { word: number; reading: number; meaning: number };

/** Template contents remain detached and inert: no scripts, media or remote resources. */
export function plainAnkiText(value: string): string {
  const template = document.createElement('template');
  template.innerHTML = value;
  template.content.querySelectorAll('script,style,iframe,object,embed,svg,math,img,audio,video,source,link,meta,template').forEach((node) => node.remove());
  template.content.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
  template.content.querySelectorAll('div,p,li,tr,h1,h2,h3,h4,blockquote').forEach((node) => node.append('\n'));
  return (template.content.textContent ?? '').replace(/\[sound:[^\]]*\]/gi, '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function buildImportedDeck(model: AnkiModel, mapping: AnkiMapping, name: string): Deck {
  const indices = [mapping.word, mapping.meaning, ...(mapping.reading === -1 ? [] : [mapping.reading])];
  if (indices.some((index) => !Number.isInteger(index) || index < 0 || index >= model.fields.length)
    || new Set(indices).size !== indices.length) throw new Error('Chọn các trường khác nhau cho từ, cách đọc và nghĩa.');
  const title = name.trim();
  if (!title || title.length > 80) throw new Error('Tên bộ thẻ cần từ 1 đến 80 ký tự.');
  if (!model.notes.length || model.notes.length > 10_000) throw new Error('Chỉ nhập bộ có từ 1 đến 10.000 ghi chú.');
  const cards = model.notes.map((note, index) => {
    const word = plainAnkiText(note.fields[mapping.word] ?? '');
    const reading = mapping.reading === -1 ? '' : plainAnkiText(note.fields[mapping.reading] ?? '');
    const meaning = plainAnkiText(note.fields[mapping.meaning] ?? '');
    if (!word || !meaning) throw new Error(`Ghi chú ${index + 1}: từ hoặc nghĩa trống sau khi bỏ HTML/media. Hãy chọn lại trường.`);
    if (word.length > 100 || reading.length > 200 || meaning.length > 1000) {
      throw new Error(`Ghi chú ${index + 1} quá dài: tối đa 100 ký tự cho từ, 200 cho cách đọc, 1.000 cho nghĩa. Không có dữ liệu nào được nhập.`);
    }
    return { id: crypto.randomUUID(), word, reading, meaning, dueAt: 0, reviewedAt: null, known: null };
  });
  return { id: crypto.randomUUID(), name: title, description: 'Nội dung chữ nhập từ Anki. Lịch ôn bắt đầu lại trên YomuJi.', sample: false, cards };
}
