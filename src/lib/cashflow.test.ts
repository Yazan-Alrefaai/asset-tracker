import { describe, expect, it } from 'vitest';
import {
  builtInCategories,
  byCategory,
  customCategories,
  filterFlows,
  flowSyp,
  flowUsd,
  inPeriod,
  isBuiltInCategory,
  monthlySeries,
  monthsInPeriod,
  monthsWithData,
  normalizeFlowMoney,
  parsePeriod,
  periodToString,
  shiftMonth,
  sortNewestFirst,
  summarizeFlows,
  yearsWithData,
} from './cashflow';
import { flow } from './test-fixtures';

describe('cash flow money', () => {
  it('values USD entries as they are, and in SYP at that day’s rate', () => {
    const f = flow({ amount: 500, currency: 'USD', usdRate: 1, sypRate: 150 });
    expect(flowUsd(f)).toBe(500);
    expect(flowSyp(f)).toBe(75_000);
  });

  it('values SYP entries exactly in SYP, and in USD at that day’s rate', () => {
    const f = flow({ amount: 1_530_000, currency: 'SYP', usdRate: 153, sypRate: 153 });
    expect(flowUsd(f)).toBeCloseTo(10_000, 6);
    expect(flowSyp(f)).toBe(1_530_000);
  });

  it('converts other currencies through their USD rate', () => {
    // 1 USD = 0.9 EUR that day, 1 USD = 150 SYP
    const f = flow({ amount: 90, currency: 'EUR', usdRate: 0.9, sypRate: 150 });
    expect(flowUsd(f)).toBeCloseTo(100, 9);
    expect(flowSyp(f)).toBeCloseTo(15_000, 6);
  });

  it('has no SYP value when the day’s SYP rate is unknown', () => {
    expect(flowSyp(flow({ amount: 10, currency: 'USD', sypRate: null }))).toBeNull();
    expect(flowSyp(flow({ amount: 10, currency: 'USD', sypRate: 0 }))).toBeNull();
  });

  it('never divides by zero for a broken rate', () => {
    expect(flowUsd(flow({ amount: 10, usdRate: 0 }))).toBe(10);
  });

  it('turns old Syrian pounds and old-pound rates into new ones', () => {
    expect(normalizeFlowMoney('SYP_OLD', 1_500_000, 15_300)).toEqual({ currency: 'SYP', amount: 15_000, sypRate: 153 });
    expect(normalizeFlowMoney('USD', 200, 153)).toEqual({ currency: 'USD', amount: 200, sypRate: 153 });
    expect(normalizeFlowMoney('SYP', 15_000, null)).toEqual({ currency: 'SYP', amount: 15_000, sypRate: null });
  });
});

describe('periods', () => {
  it('moves months across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-11', -11)).toBe('2025-12');
    expect(shiftMonth('2026-05', 0)).toBe('2026-05');
    expect(shiftMonth('2026-03', -27)).toBe('2023-12');
  });

  it('round-trips periods through strings and rejects junk', () => {
    for (const p of [{ kind: 'all' }, { kind: 'month', key: '2026-11' }, { kind: 'year', key: '2026' }] as const) {
      expect(parsePeriod(periodToString(p))).toEqual(p);
    }
    expect(parsePeriod('m:2026-1')).toEqual({ kind: 'all' });
    expect(parsePeriod('nonsense', { kind: 'month', key: '2026-11' })).toEqual({ kind: 'month', key: '2026-11' });
  });

  it('matches dates to months and years', () => {
    expect(inPeriod('2026-11-30', { kind: 'month', key: '2026-11' })).toBe(true);
    expect(inPeriod('2026-12-01', { kind: 'month', key: '2026-11' })).toBe(false);
    expect(inPeriod('2026-01-01', { kind: 'year', key: '2026' })).toBe(true);
    expect(inPeriod('2025-12-31', { kind: 'year', key: '2026' })).toBe(false);
    expect(inPeriod('1999-01-01', { kind: 'all' })).toBe(true);
  });

  it('counts months for per-month averages', () => {
    const today = '2026-11-27';
    expect(monthsInPeriod({ kind: 'month', key: '2026-11' }, [], today)).toBe(1);
    expect(monthsInPeriod({ kind: 'year', key: '2026' }, [], today)).toBe(11);
    expect(monthsInPeriod({ kind: 'year', key: '2025' }, [], today)).toBe(12);
    expect(monthsInPeriod({ kind: 'all' }, [{ date: '2026-02-10' }, { date: '2025-12-01' }], today)).toBe(12);
    expect(monthsInPeriod({ kind: 'all' }, [], today)).toBe(1);
  });
});

describe('filtering and lists', () => {
  const salary = flow({ id: 1, kind: 'income', category: 'salary', date: '2026-11-01', amount: 800, portfolioId: 1 });
  const rent = flow({ id: 2, kind: 'expense', category: 'housing', date: '2026-11-03', amount: 200, portfolioId: 1 });
  const shop = flow({ id: 3, kind: 'expense', category: 'Shop supplies', date: '2026-10-20', amount: 50, portfolioId: 2 });
  const gen = flow({ id: 4, kind: 'expense', category: 'Generator', date: '2026-11-03', amount: 20, portfolioId: 1 });
  const gen2 = flow({ id: 5, kind: 'expense', category: 'Generator', date: '2025-06-03', amount: 20, portfolioId: 1 });
  const all = [salary, rent, shop, gen, gen2];

  it('filters by portfolio, period, kind and category', () => {
    expect(filterFlows(all, { portfolioId: 'all', period: { kind: 'month', key: '2026-11' } }).map((f) => f.id)).toEqual([1, 2, 4]);
    expect(filterFlows(all, { portfolioId: 2, period: { kind: 'all' } }).map((f) => f.id)).toEqual([3]);
    expect(filterFlows(all, { portfolioId: 'all', period: { kind: 'year', key: '2026' }, kind: 'expense' }).map((f) => f.id)).toEqual([2, 3, 4]);
    expect(filterFlows(all, { portfolioId: 'all', period: { kind: 'all' }, category: 'Generator' }).map((f) => f.id)).toEqual([4, 5]);
  });

  it('sorts newest first, and the last added first on the same day', () => {
    expect(sortNewestFirst(all).map((f) => f.id)).toEqual([4, 2, 1, 3, 5]);
  });

  it('lists months and years that have data, newest first', () => {
    expect(monthsWithData(all)).toEqual(['2026-11', '2026-10', '2025-06']);
    expect(yearsWithData(all)).toEqual(['2026', '2025']);
  });

  it('suggests the user’s own categories, most used first', () => {
    expect(customCategories(all, 'expense')).toEqual(['Generator', 'Shop supplies']);
    expect(customCategories(all, 'income')).toEqual([]);
  });

  it('knows the built-in categories of each kind', () => {
    expect(builtInCategories('income')).toContain('salary');
    expect(builtInCategories('expense')).toContain('food');
    expect(isBuiltInCategory('expense', 'salary')).toBe(false);
    expect(isBuiltInCategory('income', 'other')).toBe(true);
    expect(isBuiltInCategory('expense', 'other')).toBe(true);
  });
});

describe('totals', () => {
  it('adds income and expenses at each day’s own rate', () => {
    const s = summarizeFlows([
      flow({ kind: 'income', amount: 1000, currency: 'USD', sypRate: 150 }),
      flow({ kind: 'income', amount: 306_000, currency: 'SYP', usdRate: 153, sypRate: 153 }),
      flow({ kind: 'expense', amount: 450, currency: 'USD', sypRate: 152 }),
    ]);
    expect(s.incomeUsd).toBeCloseTo(3000, 6);
    expect(s.expenseUsd).toBeCloseTo(450, 6);
    expect(s.netUsd).toBeCloseTo(2550, 6);
    expect(s.incomeSyp).toBeCloseTo(150_000 + 306_000, 6);
    expect(s.expenseSyp).toBeCloseTo(68_400, 6);
    expect(s.netSyp).toBeCloseTo(387_600, 6);
    expect(s.savingsRate).toBeCloseTo(0.85, 9);
    expect(s.incomeCount).toBe(2);
    expect(s.expenseCount).toBe(1);
  });

  it('shows a negative net and savings rate when spending more than earning', () => {
    const s = summarizeFlows([flow({ kind: 'income', amount: 100 }), flow({ kind: 'expense', amount: 150 })]);
    expect(s.netUsd).toBe(-50);
    expect(s.savingsRate).toBe(-0.5);
  });

  it('has no savings rate without income, and no SYP totals when a rate is missing', () => {
    const s = summarizeFlows([flow({ kind: 'expense', amount: 10, sypRate: null })]);
    expect(s.savingsRate).toBeNull();
    expect(s.expenseSyp).toBeNull();
    expect(s.netSyp).toBeNull();
    expect(s.incomeSyp).toBe(0);
  });

  it('is all zeros for no entries', () => {
    expect(summarizeFlows([])).toEqual({
      incomeUsd: 0,
      expenseUsd: 0,
      netUsd: 0,
      incomeSyp: 0,
      expenseSyp: 0,
      netSyp: 0,
      savingsRate: null,
      incomeCount: 0,
      expenseCount: 0,
    });
  });

  it('groups by category with shares of the kind’s total', () => {
    const slices = byCategory(
      [
        flow({ kind: 'expense', category: 'food', amount: 300 }),
        flow({ kind: 'expense', category: 'housing', amount: 500 }),
        flow({ kind: 'expense', category: 'food', amount: 200 }),
        flow({ kind: 'income', category: 'salary', amount: 9999 }),
      ],
      'expense',
    );
    expect(slices.map((s) => [s.category, s.usd, s.count])).toEqual([
      ['food', 500, 2],
      ['housing', 500, 1],
    ]);
    expect(slices.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1, 12);
    expect(byCategory([], 'income')).toEqual([]);
  });

  it('builds a monthly series with empty months as zero', () => {
    const pts = monthlySeries(
      [
        flow({ kind: 'income', date: '2026-11-01', amount: 800 }),
        flow({ kind: 'expense', date: '2026-11-15', amount: 300 }),
        flow({ kind: 'expense', date: '2026-09-02', amount: 100, sypRate: null }),
        flow({ kind: 'income', date: '2025-01-01', amount: 5 }), // outside the window
      ],
      '2026-11',
      3,
    );
    expect(pts.map((p) => p.month)).toEqual(['2026-09', '2026-10', '2026-11']);
    expect(pts.map((p) => [p.incomeUsd, p.expenseUsd, p.netUsd])).toEqual([
      [0, 100, -100],
      [0, 0, 0],
      [800, 300, 500],
    ]);
    expect(pts[0].expenseSyp).toBeNull();
    expect(pts[1].incomeSyp).toBe(0);
  });
});
