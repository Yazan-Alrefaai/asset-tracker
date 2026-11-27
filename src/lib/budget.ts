/** Monthly spending budget for income & expenses: pure calculations (no React, no database). */
import { filterFlows, summarizeFlows } from './cashflow';
import type { CashFlow } from './model';

export interface Budget {
  /** Spending limit per month (null or ≤ 0 = no budget). */
  limit: number | null;
  currency: 'USD' | 'SYP';
  /** Only this portfolio's expenses (null = all portfolios). */
  portfolioId: number | null;
}

export type BudgetLevel = 0 | 80 | 100;

export interface BudgetStatus {
  month: string;
  currency: 'USD' | 'SYP';
  limit: number;
  spent: number;
  /** spent ÷ limit (1 = exactly at the limit) */
  ratio: number;
  /** limit − spent (negative when over budget) */
  remaining: number;
  /** 100 = at or over the limit, 80 = at least 80% used, 0 = below 80% */
  level: BudgetLevel;
}

/** Share of the budget that triggers the first warning. */
export const BUDGET_WARN_AT = 0.8;

/**
 * How much of the month's budget is used. Expenses keep their own day's rate; in an SYP budget,
 * entries without an SYP rate for their day are converted at today's market rate (`sypBuy`).
 */
export function budgetStatus(flows: CashFlow[], month: string, b: Budget, sypBuy: number | null): BudgetStatus | null {
  if (b.limit == null || !(b.limit > 0)) return null;
  const expenses = filterFlows(flows, { portfolioId: b.portfolioId ?? 'all', period: { kind: 'month', key: month }, kind: 'expense' });
  const s = summarizeFlows(expenses);
  const spent = b.currency === 'USD' ? s.expenseUsd : (s.expenseSyp ?? (sypBuy ? s.expenseUsd * sypBuy : null));
  if (spent == null) return null;
  const ratio = spent / b.limit;
  return {
    month,
    currency: b.currency,
    limit: b.limit,
    spent,
    ratio,
    remaining: b.limit - spent,
    level: ratio >= 1 ? 100 : ratio >= BUDGET_WARN_AT ? 80 : 0,
  };
}

/**
 * The warning to send now, or null. Each level is sent once per month: `lastSent` is the last
 * warning recorded, as "YYYY-MM:80" or "YYYY-MM:100".
 */
export function budgetWarning(status: BudgetStatus | null, lastSent: string): 80 | 100 | null {
  if (!status || status.level === 0) return null;
  const [month, level] = lastSent.split(':');
  const already = month === status.month ? Number(level) || 0 : 0;
  return status.level > already ? status.level : null;
}

/** Days left in the month after `today` (both "YYYY-MM-DD"), counting today. */
export function daysLeftInMonth(today: string): number {
  const [y, m, d] = today.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return Math.max(0, last - d + 1);
}
