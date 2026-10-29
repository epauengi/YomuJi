import type { ConjugationData } from '@/types/kotoba';

// ponytail: Bounded per-tab cache; use persistent storage only if offline form tables are needed.
const cache = new Map<string, { expires: number; promise: Promise<ConjugationData> }>();

export function getConjugation(mode: 'search' | 'forms', query: string, sequence?: number): Promise<ConjugationData> {
  const params = new URLSearchParams({ mode, q: query.normalize('NFKC').trim() });
  if (sequence) params.set('seq', String(sequence));
  const key = params.toString();
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const promise = fetch(`/api/conjugation?${key}`, { signal: AbortSignal.timeout(6500) }).then(async (response) => {
    if (!response.ok) throw new Error('Chưa thể tải dữ liệu dạng chia.');
    return response.json() as Promise<ConjugationData>;
  });
  const entry = { expires: Date.now() + 300_000, promise };
  cache.delete(key);
  if (cache.size >= 100) cache.delete(cache.keys().next().value!);
  cache.set(key, entry);
  void promise.catch(() => { entry.expires = Date.now() + 30_000; });
  return promise;
}

export const conjugationLabels: Record<string, string> = {
  affirmative: 'Khẳng định', negative: 'Phủ định', polite: 'Lịch sự',
  'polite-negative': 'Lịch sự phủ định', forms: 'Các dạng khác',
  dict: 'Dạng từ điển', present: 'Hiện tại / tương lai', past: 'Quá khứ', te: 'Thể て',
  'cond-ba': 'Điều kiện ば', 'cond-tara': 'Điều kiện たら', potential: 'Khả năng',
  passive: 'Bị động', causative: 'Sai khiến', imperative: 'Mệnh lệnh', volitional: 'Ý chí',
  'caus-passive': 'Sai khiến bị động', desire: 'Mong muốn', prohibitive: 'Cấm chỉ', 'adverb-ku': 'Trạng từ く',
  'adverb-ni': 'Trạng từ に', '-ます': 'Lịch sự', '-た': 'Quá khứ', '-ない': 'Phủ định',
  '-て': 'Thể て', '-たい': 'Mong muốn', '-ば': 'Điều kiện ば', '-たら': 'Điều kiện たら',
};
