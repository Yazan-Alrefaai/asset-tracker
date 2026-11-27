import { describe, expect, it } from 'vitest';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../lib/cashflow';
import { ar } from './ar';
import { en } from './en';

/** "a.b.c" → value type, for every leaf of a messages object. */
function leaves(o: unknown, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') for (const [kk, vv] of leaves(v, key)) out.set(kk, vv);
    else out.set(key, typeof v);
  }
  return out;
}

describe('messages', () => {
  it('Arabic has exactly the same keys and kinds of values as English', () => {
    expect([...leaves(ar).entries()].sort()).toEqual([...leaves(en).entries()].sort());
  });

  it('has no empty text in either language', () => {
    for (const lang of [en, ar]) {
      for (const [key, kind] of leaves(lang)) {
        if (kind !== 'string') continue;
        const value = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], lang);
        expect(String(value).trim(), key).not.toBe('');
      }
    }
  });

  it('names every built-in income and expense category, and nothing else', () => {
    for (const lang of [en, ar]) {
      expect(Object.keys(lang.cashflow.incomeCategories).sort()).toEqual([...INCOME_CATEGORIES].sort());
      expect(Object.keys(lang.cashflow.expenseCategories).sort()).toEqual([...EXPENSE_CATEGORIES].sort());
    }
  });

  it('uses Arabic plural forms for entry counts', () => {
    expect(ar.cashflow.entries(1)).toBe('قيد واحد');
    expect(ar.cashflow.entries(2)).toBe('قيدان');
    expect(ar.cashflow.entries(5)).toBe('5 قيود');
    expect(ar.cashflow.entries(25)).toBe('25 قيداً');
    expect(en.cashflow.entries(1)).toBe('1 entry');
    expect(en.cashflow.entries(3)).toBe('3 entries');
  });
});
