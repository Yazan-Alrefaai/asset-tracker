/**
 * Gains over time from the daily snapshots: "today" and the 1W / 1M / 3M / 1Y / All ranges.
 *
 * A gain is the change in (value − money put in + profit already taken). So buying more is not a
 * gain, selling is not a loss, and only price moves count. Pure functions, no React or database.
 */
import type { Snapshot } from '../model';

export type Range = '1W' | '1M' | '3M' | '1Y' | 'ALL';
export const RANGES: Range[] = ['1W', '1M', '3M', '1Y', 'ALL'];

export interface PerfPoint {
  date: string;
  value: number;
  /** Money still put in: cost of holdings minus profit already taken (null when unknown). */
  invested: number | null;
}

export interface Change {
  amount: number;
  /** Relative to the value at the start (null when that was 0). */
  pct: number | null;
  from: string;
  to: string;
}

function shiftDate(date: string, days: number, months = 0): string {
  const [y, m, d] = date.split('-').map(Number);
  const target = new Date(y, m - 1 + months, 1);
  // Clamp to the last day of the target month (31 March − 1 month = 28/29 February).
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  const out = new Date(target.getFullYear(), target.getMonth(), Math.min(d, lastDay) + days);
  return `${out.getFullYear()}-${String(out.getMonth() + 1).padStart(2, '0')}-${String(out.getDate()).padStart(2, '0')}`;
}

/** The calendar day before `date` ("YYYY-MM-DD"). */
export function dayBefore(date: string): string {
  return shiftDate(date, -1);
}

/** First day of a range ending today; null for "All". */
export function rangeStart(range: Range, today: string): string | null {
  switch (range) {
    case '1W':
      return shiftDate(today, -7);
    case '1M':
      return shiftDate(today, 0, -1);
    case '3M':
      return shiftDate(today, 0, -3);
    case '1Y':
      return shiftDate(today, 0, -12);
    default:
      return null;
  }
}

/** One portfolio's daily points in USD or SYP, oldest first (portfolio 0 = everything together). */
export function perfSeries(snapshots: Snapshot[], portfolioId: number, currency: 'USD' | 'SYP'): PerfPoint[] {
  return snapshots
    .filter((s) => s.portfolioId === portfolioId)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .flatMap((s): PerfPoint[] => {
      if (currency === 'USD') return [{ date: s.date, value: s.valueUsd, invested: s.costUsd - (s.realizedUsd ?? 0) }];
      if (s.valueSyp == null) return [];
      // Snapshots from before 0.3 have no SYP cost: estimate it with that day's own rate.
      const rate = s.valueUsd > 0 ? s.valueSyp / s.valueUsd : null;
      const cost = s.costSyp ?? (rate != null ? s.costUsd * rate : null);
      const realized = s.realizedSyp ?? (s.realizedUsd != null && rate != null ? s.realizedUsd * rate : 0);
      return [{ date: s.date, value: s.valueSyp, invested: cost == null ? null : cost - realized }];
    });
}

/** Gain from a to b, leaving out money added or taken out. */
export function gainBetween(a: PerfPoint, b: PerfPoint): Change {
  const amount = a.invested != null && b.invested != null ? b.value - b.invested - (a.value - a.invested) : b.value - a.value;
  return { amount, pct: a.value > 0 ? amount / a.value : null, from: a.date, to: b.date };
}

/**
 * Points to draw for a range, and the gain over it. The gain starts from the last day recorded on or
 * before the range start (so "1M" really means since a month ago), or the first day recorded after it.
 */
export function rangeView(points: PerfPoint[], range: Range, today: string): { shown: PerfPoint[]; change: Change | null } {
  const start = rangeStart(range, today);
  const shown = start ? points.filter((p) => p.date >= start) : points;
  if (!points.length) return { shown, change: null };
  const before = start ? points.filter((p) => p.date <= start).at(-1) : undefined;
  const base = before ?? shown[0];
  const last = points[points.length - 1];
  return { shown, change: base && last && base.date !== last.date ? gainBetween(base, last) : null };
}

/** Change since the last day recorded before today, using today's live totals. */
export function todayChange(points: PerfPoint[], now: PerfPoint | null, today: string): Change | null {
  if (!now) return null;
  const prev = points.filter((p) => p.date < today).at(-1);
  return prev ? gainBetween(prev, { ...now, date: today }) : null;
}
