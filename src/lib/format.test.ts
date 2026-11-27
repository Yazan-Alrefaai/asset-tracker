import { describe, expect, it } from 'vitest';
import { karatLabel } from './catalog';
import { fmtMoney, fmtMonth, parseNum, toInput } from './format';

describe('parseNum', () => {
  it('reads normal and grouped numbers', () => {
    expect(parseNum('1234.5')).toBe(1234.5);
    expect(parseNum('1,234.5')).toBe(1234.5);
    expect(parseNum(' 15 225 ')).toBe(15225);
    expect(parseNum('.5')).toBe(0.5);
  });

  it('reads Arabic digits and the Arabic decimal point', () => {
    expect(parseNum('١٥٢٫٧٥')).toBe(152.75);
    expect(parseNum('١٬٢٣٤')).toBe(1234);
    expect(parseNum('۱۲۳')).toBe(123);
  });

  it('rejects text that is not a number', () => {
    expect(parseNum('')).toBeNull();
    expect(parseNum('abc')).toBeNull();
    expect(parseNum('1.2.3')).toBeNull();
  });
});

describe('formatting', () => {
  it('formats money with sensible decimals', () => {
    expect(fmtMoney(1234.5, 'USD', 'en')).toBe('$1,234.50');
    expect(fmtMoney(152_250, 'SYP', 'en')).toMatch(/152,250/);
    expect(fmtMoney(null, 'USD', 'en')).toBe('—');
  });

  it('keeps Western digits in Arabic', () => {
    expect(fmtMoney(1234.5, 'USD', 'ar')).toMatch(/1,234\.50/);
  });

  it('trims float noise for inputs', () => {
    expect(toInput(0.1 + 0.2)).toBe('0.3');
    expect(toInput(null)).toBe('');
  });

  it('names standard karats only', () => {
    expect(karatLabel(0.875)).toBe('21K');
    expect(karatLabel(1)).toBe('24K');
    expect(karatLabel(0.9999)).toBe('24K');
    expect(karatLabel(0.8)).toBeNull();
  });
});

describe('fmtMonth', () => {
  it('names a month in English and Arabic', () => {
    expect(fmtMonth('2026-11', 'en')).toBe('November 2026');
    expect(fmtMonth('2026-11', 'en', 'short')).toBe('Nov 26');
    expect(fmtMonth('2026-01', 'ar')).toContain('2026');
  });

  it('returns broken keys unchanged', () => {
    expect(fmtMonth('soon', 'en')).toBe('soon');
  });
});

describe('Syrian pound amounts', () => {
  it('shows zero without decimals', () => {
    expect(fmtMoney(0, 'SYP', 'en')).toBe('SYP 0');
    expect(fmtMoney(152.5, 'SYP', 'en')).toBe('SYP 152.50');
    expect(fmtMoney(15_550, 'SYP', 'en')).toBe('SYP 15,550');
  });
});
