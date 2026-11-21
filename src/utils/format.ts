const yenFormatter = new Intl.NumberFormat('ja-JP');

export function yen(v: number): string {
  return `${yenFormatter.format(Math.round(v))}円`;
}

export function signedYen(v: number): string {
  const r = Math.round(v);
  return `${r > 0 ? '+' : ''}${yenFormatter.format(r)}`;
}

export function signedCoins(v: number): string {
  const r = Math.round(v);
  return `${r > 0 ? '+' : ''}${yenFormatter.format(r)}枚`;
}

export function num(v: number): string {
  return yenFormatter.format(Math.round(v));
}

/** 1/x 表記の確率 */
export function odds(count: number, games: number): string {
  if (count === 0) return '—';
  return `1/${(games / count).toFixed(1)}`;
}

/** 分単位の時刻を HH:MM に */
export function clockLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

export function dateLabel(iso: string): string {
  const d = parseDate(iso);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}(${WEEKDAYS[d.getDay()]})`;
}

export function parseDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(iso: string, days: number): string {
  const d = parseDate(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}
