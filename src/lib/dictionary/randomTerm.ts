const VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function getVietnamDayKey(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
}

export function getSecondsUntilVietnamMidnight(date = new Date()): number {
  const vietnamTime = date.getTime() + VIETNAM_UTC_OFFSET_MS;
  const nextMidnight = Math.floor(vietnamTime / DAY_MS) * DAY_MS + DAY_MS;
  return Math.ceil((nextMidnight - vietnamTime) / 1000);
}

export function selectDailyOffset(dayKey: string, count: number): number | null {
  const validDay = /^\d{4}-\d{2}-\d{2}$/.test(dayKey)
    && new Date(`${dayKey}T00:00:00.000Z`).toISOString().slice(0, 10) === dayKey;
  if (!validDay || !Number.isSafeInteger(count) || count <= 0) return null;

  let hash = 2166136261;
  for (let index = 0; index < dayKey.length; index += 1) {
    hash = Math.imul(hash ^ dayKey.charCodeAt(index), 16777619);
  }
  return (hash >>> 0) % count;
}
