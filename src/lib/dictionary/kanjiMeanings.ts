const VIETNAMESE_MARKS = /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừởỡợýỳỷỹỵ]/i;
const DICTIONARY_MARKUP = /<<ccr:|<\/?(?:tc|tvc)>|\[\/?b\]/i;
const RAW_GLOSS_MARKERS = /\b(?:khinh bạc|bộ [\p{L}]+|xem [\p{L}]{1,5} \[|một âm là|\d+\s*(?:nét|n))\b|[①-⑳]|\u3010/iu;

export function getVietnameseKanjiMeanings(meanings: unknown): string[] {
  if (!Array.isArray(meanings)) return [];

  const seen = new Set<string>();
  return meanings.filter((meaning): meaning is string => {
    if (typeof meaning !== 'string') return false;
    const value = meaning.trim();
    if (!value || value.length > 180 || DICTIONARY_MARKUP.test(value) || RAW_GLOSS_MARKERS.test(value)
      || (!VIETNAMESE_MARKS.test(value) && !/\b(của|là|và|người|được|trong|theo|một|như|với|thứ|dùng|gọi|yêu|thương|buồn|đỏ|lớn|nhỏ|nghĩa)\b/i.test(value))) return false;
    const key = value.replace(/^\[[^\]]+\]\s*/, '').toLocaleLowerCase('vi');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
