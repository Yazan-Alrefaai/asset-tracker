import { describe, expect, it } from 'vitest';
import { valueFromPercent } from './alerts';
import { budgetStatus, budgetWarning, daysLeftInMonth } from './budget';
import { flow } from './test-fixtures';

const month = '2026-11';
const flows = [
  flow({ kind: 'expense', date: '2026-11-02', amount: 300, currency: 'USD', sypRate: 150, portfolioId: 1 }),
  flow({ kind: 'expense', date: '2026-11-10', amount: 76_500, currency: 'SYP', usdRate: 153, sypRate: 153, portfolioId: 1 }), // $500
  flow({ kind: 'expense', date: '2026-11-11', amount: 1000, currency: 'USD', sypRate: 153, portfolioId: 2 }), // business
  flow({ kind: 'expense', date: '2026-10-30', amount: 999, currency: 'USD', portfolioId: 1 }), // last month
  flow({ kind: 'income', date: '2026-11-01', amount: 5000, currency: 'USD', portfolioId: 1 }), // income never counts
];

describe('monthly budget', () => {
  it('adds only this month’s expenses of the chosen portfolio', () => {
    const s = budgetStatus(flows, month, { limit: 1000, currency: 'USD', portfolioId: 1 }, 153)!;
    expect(s.spent).toBeCloseTo(800, 9);
    expect(s.ratio).toBeCloseTo(0.8, 9);
    expect(s.remaining).toBeCloseTo(200, 9);
    expect(s.level).toBe(80);
  });

  it('counts every portfolio when none is chosen', () => {
    const s = budgetStatus(flows, month, { limit: 1500, currency: 'USD', portfolioId: null }, 153)!;
    expect(s.spent).toBeCloseTo(1800, 9);
    expect(s.level).toBe(100);
    expect(s.remaining).toBeCloseTo(-300, 9);
  });

  it('works in Syrian pounds at each day’s rate', () => {
    const s = budgetStatus(flows, month, { limit: 200_000, currency: 'SYP', portfolioId: 1 }, 153)!;
    expect(s.spent).toBe(300 * 150 + 76_500);
    expect(s.level).toBe(0);
  });

  it('uses today’s rate for SYP budgets when an entry has no SYP rate', () => {
    const noRate = [flow({ kind: 'expense', date: '2026-11-03', amount: 100, currency: 'USD', sypRate: null })];
    expect(budgetStatus(noRate, month, { limit: 20_000, currency: 'SYP', portfolioId: null }, 153)!.spent).toBe(15_300);
    expect(budgetStatus(noRate, month, { limit: 20_000, currency: 'SYP', portfolioId: null }, null)).toBeNull();
  });

  it('has no status without a budget', () => {
    expect(budgetStatus(flows, month, { limit: null, currency: 'USD', portfolioId: null }, 153)).toBeNull();
    expect(budgetStatus(flows, month, { limit: 0, currency: 'USD', portfolioId: null }, 153)).toBeNull();
  });

  it('is 0% for a month with no expenses', () => {
    expect(budgetStatus(flows, '2026-12', { limit: 100, currency: 'USD', portfolioId: null }, 153)).toMatchObject({ spent: 0, level: 0 });
  });
});

describe('budget warnings', () => {
  const at = (level: 0 | 80 | 100, m = month) => ({ month: m, currency: 'USD' as const, limit: 1, spent: 1, ratio: 1, remaining: 0, level });

  it('sends 80% once, then 100% once, each month', () => {
    expect(budgetWarning(at(80), '')).toBe(80);
    expect(budgetWarning(at(80), '2026-11:80')).toBeNull();
    expect(budgetWarning(at(100), '2026-11:80')).toBe(100);
    expect(budgetWarning(at(100), '2026-11:100')).toBeNull();
    // jumping straight past the limit sends only the 100% warning
    expect(budgetWarning(at(100), '')).toBe(100);
  });

  it('starts again in a new month', () => {
    expect(budgetWarning(at(80, '2026-12'), '2026-11:100')).toBe(80);
  });

  it('sends nothing below 80% or without a budget', () => {
    expect(budgetWarning(at(0), '')).toBeNull();
    expect(budgetWarning(null, '')).toBeNull();
    expect(budgetWarning(at(80), 'garbage')).toBe(80);
  });

  it('counts the days left in the month, including today', () => {
    expect(daysLeftInMonth('2026-11-27')).toBe(4);
    expect(daysLeftInMonth('2026-11-30')).toBe(1);
    expect(daysLeftInMonth('2026-02-01')).toBe(28);
    expect(daysLeftInMonth('2028-02-01')).toBe(29);
  });
});

describe('alert line from a percentage', () => {
  it('goes up for "above" and down for "below"', () => {
    expect(valueFromPercent(3600, 3, 'above')).toBeCloseTo(3708, 9);
    expect(valueFromPercent(153, 2, 'below')).toBeCloseTo(149.94, 9);
  });

  it('refuses missing prices, zero or negative percentages, and lines at or below zero', () => {
    expect(valueFromPercent(null, 3, 'above')).toBeNull();
    expect(valueFromPercent(100, 0, 'above')).toBeNull();
    expect(valueFromPercent(100, -5, 'above')).toBeNull();
    expect(valueFromPercent(100, 100, 'below')).toBeNull();
    expect(valueFromPercent(100, null, 'below')).toBeNull();
  });
});
