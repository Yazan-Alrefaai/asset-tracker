/**
 * Income & expenses: pure calculations (no React, no database), so they are easy to test.
 *
 * Every entry keeps the exchange rates of its own day. Totals in USD and SYP therefore show
 * what the money was worth when it came in or went out, even if the pound has moved since.
 */
import { SYP_OLD, SYP_REDENOMINATION } from './catalog';
import type { CashFlow, FlowKind } from './model';

export const INCOME_CATEGORIES = [
  'salary',
  'freelance',
  'business',
  'remittance',
  'rent',
  'investment',
  'gift',
  'other',
] as const;

export const EXPENSE_CATEGORIES = [
  'food',
  'housing',
  'bills',
  'transport',
  'health',
  'education',
  'family',
  'clothes',
  'household',
  'entertainment',
  'charity',
  'debt',
  'business',
  'other',
] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export function builtInCategories(kind: FlowKind): readonly string[] {
  return kind === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

export function isBuiltInCategory(kind: FlowKind, category: string): boolean {
  return builtInCategories(kind).includes(category);
}

// ---------- money ----------

/** USD value of an entry at the rate of its own day. */
export function flowUsd(f: Pick<CashFlow, 'amount' | 'usdRate'>): number {
  return f.amount / (f.usdRate > 0 ? f.usdRate : 1);
}

/** SYP value of an entry at the rate of its own day (null when that day's rate is unknown). */
export function flowSyp(f: Pick<CashFlow, 'amount' | 'currency' | 'usdRate' | 'sypRate'>): number | null {
  if (f.currency === 'SYP') return f.amount;
  if (f.sypRate == null || !(f.sypRate > 0)) return null;
  return flowUsd(f) * f.sypRate;
}

/**
 * Turns what the user typed into what is stored: old Syrian pounds become new ones (÷100),
 * and an old-pound dollar rate (e.g. 15,300) becomes a new-pound rate (153).
 */
export function normalizeFlowMoney(
  currencyChoice: string,
  amount: number,
  sypRate: number | null,
): { currency: string; amount: number; sypRate: number | null } {
  const isOld = currencyChoice === SYP_OLD;
  return {
    currency: isOld ? 'SYP' : currencyChoice,
    amount: isOld ? amount / SYP_REDENOMINATION : amount,
    sypRate: sypRate != null && sypRate > 2000 ? sypRate / SYP_REDENOMINATION : sypRate,
  };
}

// ---------- periods ----------

export type Period = { kind: 'month'; key: string } | { kind: 'year'; key: string } | { kind: 'all' };

/** "2026-11-27" → "2026-11" */
export const monthOf = (date: string): string => date.slice(0, 7);

/** Moves a "YYYY-MM" key by whole months: shiftMonth("2026-01", -1) = "2025-12". */
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = total - ny * 12 + 1;
  return `${String(ny).padStart(4, '0')}-${String(nm).padStart(2, '0')}`;
}

/** Period as a string, for <select> values: "m:2026-11", "y:2026" or "all". */
export function periodToString(p: Period): string {
  return p.kind === 'all' ? 'all' : `${p.kind === 'month' ? 'm' : 'y'}:${p.key}`;
}

export function parsePeriod(s: string, fallback: Period = { kind: 'all' }): Period {
  if (s === 'all') return { kind: 'all' };
  const m = /^m:(\d{4}-\d{2})$/.exec(s);
  if (m) return { kind: 'month', key: m[1] };
  const y = /^y:(\d{4})$/.exec(s);
  if (y) return { kind: 'year', key: y[1] };
  return fallback;
}

export function inPeriod(date: string, p: Period): boolean {
  if (p.kind === 'all') return true;
  if (p.kind === 'month') return date.slice(0, 7) === p.key;
  return date.slice(0, 4) === p.key;
}

/** Number of calendar months a period covers, up to `today` (for "per month" averages). */
export function monthsInPeriod(p: Period, flows: Pick<CashFlow, 'date'>[], today: string): number {
  if (p.kind === 'month') return 1;
  const thisMonth = monthOf(today);
  if (p.kind === 'year') {
    if (p.key < thisMonth.slice(0, 4)) return 12;
    if (p.key > thisMonth.slice(0, 4)) return 1;
    return Number(thisMonth.slice(5, 7));
  }
  if (!flows.length) return 1;
  const first = flows.reduce((min, f) => (f.date < min ? f.date : min), flows[0].date);
  const [fy, fm] = monthOf(first).split('-').map(Number);
  const [ty, tm] = thisMonth.split('-').map(Number);
  return Math.max(1, (ty - fy) * 12 + (tm - fm) + 1);
}

// ---------- filtering ----------

export interface FlowFilter {
  portfolioId: number | 'all';
  period: Period;
  kind?: FlowKind | 'all';
  category?: string | null;
}

export function filterFlows(flows: CashFlow[], f: FlowFilter): CashFlow[] {
  return flows.filter(
    (x) =>
      (f.portfolioId === 'all' || x.portfolioId === f.portfolioId) &&
      inPeriod(x.date, f.period) &&
      (!f.kind || f.kind === 'all' || x.kind === f.kind) &&
      (f.category == null || x.category === f.category),
  );
}

/** Newest first; same day: last added first. */
export function sortNewestFirst(flows: CashFlow[]): CashFlow[] {
  return [...flows].sort((a, b) => (a.date === b.date ? b.id - a.id : a.date < b.date ? 1 : -1));
}

/** Months that have entries, newest first ("2026-11", "2026-10"…). */
export function monthsWithData(flows: Pick<CashFlow, 'date'>[]): string[] {
  return [...new Set(flows.map((f) => monthOf(f.date)))].sort().reverse();
}

/** Years that have entries, newest first. */
export function yearsWithData(flows: Pick<CashFlow, 'date'>[]): string[] {
  return [...new Set(flows.map((f) => f.date.slice(0, 4)))].sort().reverse();
}

/** The user's own categories for one kind, most used first (for suggestions in the form). */
export function customCategories(flows: Pick<CashFlow, 'kind' | 'category'>[], kind: FlowKind): string[] {
  const counts = new Map<string, number>();
  for (const f of flows) {
    if (f.kind !== kind || isBuiltInCategory(kind, f.category)) continue;
    counts.set(f.category, (counts.get(f.category) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c]) => c);
}

// ---------- totals ----------

export interface FlowSummary {
  incomeUsd: number;
  expenseUsd: number;
  netUsd: number;
  /** null when any entry has no SYP rate for its day */
  incomeSyp: number | null;
  expenseSyp: number | null;
  netSyp: number | null;
  /** Share of income that was kept (net ÷ income), null without income. */
  savingsRate: number | null;
  incomeCount: number;
  expenseCount: number;
}

export function summarizeFlows(flows: CashFlow[]): FlowSummary {
  let incomeUsd = 0;
  let expenseUsd = 0;
  let incomeSyp: number | null = 0;
  let expenseSyp: number | null = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  for (const f of flows) {
    const usd = flowUsd(f);
    const syp = flowSyp(f);
    if (f.kind === 'income') {
      incomeUsd += usd;
      incomeSyp = incomeSyp == null || syp == null ? null : incomeSyp + syp;
      incomeCount++;
    } else {
      expenseUsd += usd;
      expenseSyp = expenseSyp == null || syp == null ? null : expenseSyp + syp;
      expenseCount++;
    }
  }
  const netUsd = incomeUsd - expenseUsd;
  return {
    incomeUsd,
    expenseUsd,
    netUsd,
    incomeSyp,
    expenseSyp,
    netSyp: incomeSyp == null || expenseSyp == null ? null : incomeSyp - expenseSyp,
    savingsRate: incomeUsd > 0 ? netUsd / incomeUsd : null,
    incomeCount,
    expenseCount,
  };
}

export interface CategorySlice {
  category: string;
  usd: number;
  syp: number | null;
  /** Share of this kind's total (0..1, by USD value). */
  share: number;
  count: number;
}

/** Totals per category for one kind, biggest first. */
export function byCategory(flows: CashFlow[], kind: FlowKind): CategorySlice[] {
  const map = new Map<string, CategorySlice>();
  let total = 0;
  for (const f of flows) {
    if (f.kind !== kind) continue;
    const usd = flowUsd(f);
    const syp = flowSyp(f);
    total += usd;
    const s = map.get(f.category);
    if (s) {
      s.usd += usd;
      s.syp = s.syp == null || syp == null ? null : s.syp + syp;
      s.count++;
    } else {
      map.set(f.category, { category: f.category, usd, syp, share: 0, count: 1 });
    }
  }
  const out = [...map.values()];
  for (const s of out) s.share = total > 0 ? s.usd / total : 0;
  return out.sort((a, b) => b.usd - a.usd || a.category.localeCompare(b.category));
}

export interface MonthPoint {
  month: string;
  incomeUsd: number;
  expenseUsd: number;
  netUsd: number;
  incomeSyp: number | null;
  expenseSyp: number | null;
}

/** `count` months ending with `endMonth` (oldest first), with zeros for empty months. */
export function monthlySeries(flows: CashFlow[], endMonth: string, count = 12): MonthPoint[] {
  const months = Array.from({ length: count }, (_, i) => shiftMonth(endMonth, i - count + 1));
  const index = new Map(months.map((m, i) => [m, i]));
  const points: MonthPoint[] = months.map((month) => ({
    month,
    incomeUsd: 0,
    expenseUsd: 0,
    netUsd: 0,
    incomeSyp: 0,
    expenseSyp: 0,
  }));
  for (const f of flows) {
    const i = index.get(monthOf(f.date));
    if (i == null) continue;
    const p = points[i];
    const usd = flowUsd(f);
    const syp = flowSyp(f);
    if (f.kind === 'income') {
      p.incomeUsd += usd;
      p.incomeSyp = p.incomeSyp == null || syp == null ? null : p.incomeSyp + syp;
    } else {
      p.expenseUsd += usd;
      p.expenseSyp = p.expenseSyp == null || syp == null ? null : p.expenseSyp + syp;
    }
  }
  for (const p of points) p.netUsd = p.incomeUsd - p.expenseUsd;
  return points;
}
