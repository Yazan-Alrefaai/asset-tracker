import type { Messages } from '../i18n/en';
import type { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../lib/cashflow';
import { isBuiltInCategory } from '../lib/cashflow';
import type { FlowKind } from '../lib/model';

/** Name of a category in the current language; the user's own categories are shown as typed. */
export function categoryLabel(kind: FlowKind, category: string, t: Messages): string {
  if (!isBuiltInCategory(kind, category)) return category;
  return kind === 'income'
    ? t.cashflow.incomeCategories[category as (typeof INCOME_CATEGORIES)[number]]
    : t.cashflow.expenseCategories[category as (typeof EXPENSE_CATEGORIES)[number]];
}
