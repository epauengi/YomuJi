import { formatPartOfSpeech } from './formatters';

const MISC_LABELS: Record<string, string> = {
  uk: 'Thường viết kana',
  col: 'Thông tục',
  sl: 'Tiếng lóng',
  fam: 'Thân mật',
  pol: 'Lịch sự',
  hon: 'Kính ngữ',
  hum: 'Khiêm nhường',
  arch: 'Từ cổ',
  obs: 'Lỗi thời',
  id: 'Thành ngữ',
  derog: 'Miệt thị',
  rare: 'Hiếm gặp',
  vulg: 'Thô tục',
  proverb: 'Tục ngữ',
  yoji: 'Thành ngữ 4 chữ',
  yojijukugo: 'Thành ngữ 4 chữ',
  sens: 'Nhạy cảm',
  abbr: 'Viết tắt',
};

export function formatSensePartOfSpeech(pos: string): string {
  const norm = pos.trim().toLowerCase();
  if (norm === 'vt') return 'Ngoại động từ';
  return formatPartOfSpeech(pos);
}

export function getCleanSenseLabels(partOfSpeech: string[] = [], misc: string[] = []): string[] {
  const formattedPos = (partOfSpeech || [])
    .map(formatSensePartOfSpeech)
    .filter(Boolean);

  const formattedMisc = (misc || [])
    .map((m) => {
      const norm = m.trim().toLowerCase();
      return MISC_LABELS[norm] || m.trim();
    })
    .filter(Boolean);

  const unique = Array.from(new Set([...formattedPos, ...formattedMisc]));

  const hasSpecificVerb = unique.some(
    (l) =>
      l.includes('godan') ||
      l.includes('ichidan') ||
      l.includes('nhóm') ||
      l === 'Ngoại động từ' ||
      l === 'Nội động từ'
  );
  const hasSpecificAdj = unique.some(
    (l) => l === 'Tính từ i' || l === 'Tính từ na' || l.includes('bổ nghĩa')
  );

  return unique.filter((label) => {
    if (label === 'Động từ' && hasSpecificVerb) return false;
    if (label === 'Tính từ' && hasSpecificAdj) return false;
    return true;
  });
}

export function formatSenseRestrictions(
  appliesToKanji?: string[],
  appliesToReadings?: string[]
): string[] {
  const restrictions: string[] = [];
  const kanji = (appliesToKanji || []).map((s) => s.trim()).filter(Boolean);
  const readings = (appliesToReadings || []).map((s) => s.trim()).filter(Boolean);

  if (kanji.length > 0) {
    restrictions.push(`Chỉ dạng viết: ${kanji.join(', ')}`);
  }
  if (readings.length > 0) {
    restrictions.push(`Chỉ cách đọc: ${readings.join(', ')}`);
  }
  return restrictions;
}
