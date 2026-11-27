import { describe, expect, it } from 'vitest';
import type { Snapshot } from '../model';
import { gainBetween, perfSeries, rangeStart, rangeView, todayChange } from './performance';

function snap(date: string, valueUsd: number, costUsd: number, over: Partial<Snapshot> = {}): Snapshot {
  return {
    date,
    portfolioId: 0,
    valueUsd,
    costUsd,
    valueSyp: valueUsd * 150,
    costSyp: costUsd * 150,
    realizedUsd: 0,
    realizedSyp: 0,
    ...over,
  };
}

describe('range start', () => {
  const today = '2026-11-27';
  it('goes back a week, a month, three months or a year', () => {
    expect(rangeStart('1W', today)).toBe('2026-11-20');
    expect(rangeStart('1M', today)).toBe('2026-10-27');
    expect(rangeStart('3M', today)).toBe('2026-08-27');
    expect(rangeStart('1Y', today)).toBe('2025-11-27');
    expect(rangeStart('ALL', today)).toBeNull();
  });

  it('keeps to real days at month ends and across years', () => {
    expect(rangeStart('1M', '2026-03-31')).toBe('2026-02-28');
    expect(rangeStart('1M', '2028-03-31')).toBe('2028-02-29');
    expect(rangeStart('3M', '2026-01-15')).toBe('2025-10-15');
    expect(rangeStart('1W', '2026-01-03')).toBe('2025-12-27');
  });
});

describe('gains leave out money added or taken out', () => {
  it('a price move is a gain', () => {
    const [a, b] = perfSeries([snap('2026-11-01', 1000, 1000), snap('2026-11-02', 1100, 1000)], 0, 'USD');
    expect(gainBetween(a, b)).toEqual({ amount: 100, pct: 0.1, from: '2026-11-01', to: '2026-11-02' });
  });

  it('buying more is not a gain', () => {
    const [a, b] = perfSeries([snap('2026-11-01', 1000, 1000), snap('2026-11-02', 1500, 1500)], 0, 'USD');
    expect(gainBetween(a, b).amount).toBe(0);
  });

  it('selling is not a loss: the profit moves from value to "taken"', () => {
    // Held 1,200 bought for 1,000; sold half at today's price: value 600, cost 500, profit taken 100.
    const pts = perfSeries([snap('2026-11-01', 1200, 1000), snap('2026-11-02', 600, 500, { realizedUsd: 100, realizedSyp: 15_000 })], 0, 'USD');
    expect(gainBetween(pts[0], pts[1]).amount).toBe(0);
  });

  it('works in SYP, and estimates SYP cost for snapshots saved before 0.3', () => {
    const old = snap('2026-11-01', 1000, 1000, { valueSyp: 150_000, costSyp: null, realizedUsd: null, realizedSyp: null });
    const now = snap('2026-11-02', 1000, 1000, { valueSyp: 155_000, costSyp: 150_000 });
    const [a, b] = perfSeries([old, now], 0, 'SYP');
    expect(a.invested).toBe(150_000);
    expect(gainBetween(a, b).amount).toBe(5_000);
  });

  it('skips days without an SYP value and keeps portfolios apart', () => {
    const list = [snap('2026-11-01', 1, 1, { valueSyp: null }), snap('2026-11-02', 2, 2), snap('2026-11-02', 9, 9, { portfolioId: 2 })];
    expect(perfSeries(list, 0, 'SYP').map((p) => p.date)).toEqual(['2026-11-02']);
    expect(perfSeries(list, 2, 'USD').map((p) => p.value)).toEqual([9]);
  });
});

describe('ranges and today', () => {
  const today = '2026-11-27';
  const pts = perfSeries(
    [
      snap('2026-10-20', 900, 1000),
      snap('2026-10-27', 950, 1000),
      snap('2026-11-20', 1000, 1000),
      snap('2026-11-26', 1050, 1000),
      snap('2026-11-27', 1100, 1200), // bought 200 more today and it went up 50
    ],
    0,
    'USD',
  );

  it('measures a range from the day on or before its start', () => {
    const w = rangeView(pts, '1W', today);
    expect(w.shown.map((p) => p.date)).toEqual(['2026-11-20', '2026-11-26', '2026-11-27']);
    expect(w.change).toMatchObject({ amount: (1100 - 1200) - (1000 - 1000), from: '2026-11-20' });
    const m = rangeView(pts, '1M', today);
    expect(m.change).toMatchObject({ from: '2026-10-27', amount: (1100 - 1200) - (950 - 1000) });
  });

  it('starts "All" at the first day recorded', () => {
    expect(rangeView(pts, 'ALL', today).change).toMatchObject({ from: '2026-10-20', amount: -100 - -100 });
  });

  it('has no change with fewer than two days', () => {
    expect(rangeView([], '1M', today)).toEqual({ shown: [], change: null });
    expect(rangeView(pts.slice(-1), '1W', today).change).toBeNull();
  });

  it('compares today’s live totals with the last day before today', () => {
    const c = todayChange(pts, { date: today, value: 1110, invested: 1200 }, today)!;
    expect(c.from).toBe('2026-11-26');
    expect(c.amount).toBe((1110 - 1200) - (1050 - 1000));
    expect(c.pct).toBeCloseTo(-140 / 1050, 12);
    expect(todayChange(pts.slice(-1), { date: today, value: 1, invested: 1 }, today)).toBeNull();
    expect(todayChange(pts, null, today)).toBeNull();
  });
});
