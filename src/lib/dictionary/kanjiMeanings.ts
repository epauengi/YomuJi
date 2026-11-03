const VIETNAMESE_MARKS = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìịóòỏõọốồổỗộớờởỡợúùủũụứừởỡợýỳỷỹỵ]/i;
const DICTIONARY_MARKUP = /<<ccr:|<\/?(?:tc|tvc)>|\[\/?b\]/i;
const RAW_GLOSS_MARKERS = /\b(?:xem [\p{L}]{1,5} \[|một âm là|\d+\s*(?:nét|n))\b|[①-⑳]|\u3010/iu;

export interface KanjiMeaning {
  label: string;
  examples: Array<{ surface: string; reading: string; meaning: string }>;
}

export function formatKanjiHanViet(readings: unknown): string[] {
  if (!Array.isArray(readings)) return [];
  const seen = new Set<string>();
  return readings.flatMap((reading) => typeof reading === 'string'
    ? reading.split(/[\s,;，；]+/).map((part) => part.trim()).filter((part) => {
        const key = part.normalize('NFC').toLocaleLowerCase('vi');
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
    : []);
}

export function getVietnameseKanjiMeanings(meanings: unknown): KanjiMeaning[] {
  if (!Array.isArray(meanings)) return [];

  const seen = new Set<string>();
  return meanings.flatMap((meaning) => {
    if (typeof meaning !== 'string') return [];
    const value = meaning.trim();
    const match = value.match(/^\[([^\]]+)\]\s*(.+)$/);
    const label = match?.[2].trim() ?? value;
    const radicalOnly = /^bộ\s+(\S+)$/iu.exec(label);
    if (!value || value.length > 180 || DICTIONARY_MARKUP.test(value) || RAW_GLOSS_MARKERS.test(value)
      || (radicalOnly && match && radicalOnly[1].localeCompare(match[1], 'vi', { sensitivity: 'accent' }) === 0 && label.toLocaleLowerCase('vi') !== 'bộ não')
      || (!match && !VIETNAMESE_MARKS.test(value) && !/\b(của|là|và|người|được|trong|theo|một|như|với|thứ|dùng|gọi|yêu|thương|buồn|đỏ|lớn|nhỏ|nghĩa)\b/i.test(value))) return [];

    const key = label.normalize('NFC').toLocaleLowerCase('vi');
    if (!label || seen.has(key)) return [];
    seen.add(key);
    return [{ label, examples: [] }];
  });
}

export function attachKanjiMeaningExamples(
  meanings: KanjiMeaning[],
  compounds: Array<{ surface: string; reading: string; meaningsVi: string[] }>,
  literal: string,
): KanjiMeaning[] {
  return meanings.map((meaning) => {
    const label = meaning.label.normalize('NFC').toLocaleLowerCase('vi');
    const examples = compounds.flatMap((term) => {
      const surface = Array.from(term.surface);
      if (surface.length === 1 || surface.length > 6 || !surface.includes(literal)) return [];
      const matchingGloss = term.meaningsVi.find((gloss) => {
        const value = gloss.normalize('NFC').toLocaleLowerCase('vi').trim();
        if (value === label) return true;
        return label === 'ăn' && ['bữa ăn', 'món ăn', 'đồ ăn', 'ăn uống'].includes(value)
          || label === 'đồ ăn' && value === 'món ăn';
      });
      return matchingGloss ? [{ surface: term.surface, reading: term.reading, meaning: matchingGloss }] : [];
    });
    return { ...meaning, examples: examples.slice(0, 2) };
  });
}
