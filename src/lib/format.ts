import type { AssetType } from './model';
import type { Language } from './settings';

/** Arabic uses Western digits (1,234.5) so financial numbers stay easy to compare. */
export function intlLocale(lang: Language): string {
  return lang === 'ar' ? 'ar-SY-u-nu-latn' : 'en-US';
}

const nfCache = new Map<string, Intl.NumberFormat>();
function nf(lang: Language, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = lang + JSON.stringify(opts);
  let f = nfCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(intlLocale(lang), opts);
    nfCache.set(key, f);
  }
  return f;
}

export const DASH = '—';

export function moneyDecimals(v: number, currency: string): number {
  const a = Math.abs(v);
  if (currency === 'SYP') return a >= 1000 ? 0 : 2;
  if (a === 0 || a >= 1) return 2;
  if (a >= 0.01) return 4;
  return 6;
}

export interface MoneyOpts {
  decimals?: number;
  compact?: boolean;
  sign?: boolean;
}

const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };

/** Keeps a signed number together left-to-right inside Arabic text (so "-45" never shows as "45-"). */
const LRI = '⁦';
const PDI = '⁩';
export const isolate = (s: string, lang: Language) => (lang === 'ar' ? `${LRI}${s}${PDI}` : s);

/**
 * Money: "$1,234.50", "SYP 152,250" in English; "$1,234.50", "152,250 ل.س" in Arabic.
 * Digits are always Western so amounts are easy to compare.
 */
export function fmtMoney(v: number | null | undefined, currency: string, lang: Language, o: MoneyOpts = {}): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const d = o.decimals ?? (o.compact ? 1 : moneyDecimals(v, currency));
  const digits = nf(lang, {
    minimumFractionDigits: o.compact ? 0 : d,
    maximumFractionDigits: d,
    notation: o.compact ? 'compact' : 'standard',
  }).format(Math.abs(v));
  const sign = v < 0 && Number(digits.replace(/[^\d.]/g, '')) !== 0 ? '-' : o.sign && v > 0 ? '+' : '';
  const sym = SYMBOLS[currency];
  if (lang === 'ar') {
    if (sym) return isolate(`${sign}${sym}${digits}`, lang);
    return `${isolate(`${sign}${digits}`, lang)} ${currency === 'SYP' ? 'ل.س' : currency}`;
  }
  return sym ? `${sign}${sym}${digits}` : `${sign}${currency} ${digits}`;
}

export function fmtNum(v: number | null | undefined, lang: Language, maxDecimals = 2, minDecimals = 0): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const s = nf(lang, { minimumFractionDigits: minDecimals, maximumFractionDigits: maxDecimals }).format(v);
  return v < 0 ? isolate(s, lang) : s;
}

export function qtyDecimals(type: AssetType): number {
  switch (type) {
    case 'crypto':
      return 8;
    case 'gold':
    case 'silver':
      return 3;
    case 'cash':
      return 2;
    default:
      return 4;
  }
}

export function fmtPct(v: number | null | undefined, lang: Language, sign = true): string {
  if (v == null || !Number.isFinite(v)) return DASH;
  const s = nf(lang, {
    style: 'percent',
    minimumFractionDigits: Math.abs(v) < 0.1 ? 2 : 1,
    maximumFractionDigits: Math.abs(v) < 0.1 ? 2 : 1,
    signDisplay: sign ? 'exceptZero' : 'auto',
  }).format(v);
  return isolate(s, lang);
}

export function fmtDate(isoDate: string, lang: Language): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat(intlLocale(lang), { year: 'numeric', month: 'short', day: 'numeric' }).format(
    new Date(y, m - 1, d),
  );
}

export function fmtShortDate(isoDate: string, lang: Language): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  return new Intl.DateTimeFormat(intlLocale(lang), { month: 'short', day: 'numeric' }).format(new Date(y, m - 1, d));
}

/** "2026-11" → "Nov 2026" (short) or "November 2026" (long). */
export function fmtMonth(key: string, lang: Language, style: 'short' | 'long' = 'long'): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Intl.DateTimeFormat(intlLocale(lang), {
    month: style === 'long' ? 'long' : 'short',
    year: style === 'long' ? 'numeric' : '2-digit',
  }).format(new Date(y, m - 1, 1));
}

export function fmtAgo(iso: string | null | undefined, lang: Language, now = Date.now()): string {
  if (!iso) return DASH;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return DASH;
  const s = Math.round((t - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat(intlLocale(lang), { numeric: 'auto' });
  const a = Math.abs(s);
  if (a < 45) return rtf.format(Math.min(0, s), 'second');
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}

const DIGIT_MAP: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

/** Reads a number typed by the user: accepts Arabic digits, "٫" as decimal point, and thousands separators. */
export function parseNum(input: string | null | undefined): number | null {
  if (input == null) return null;
  const s = String(input)
    .trim()
    .replace(/[٠-٩۰-۹]/g, (c) => DIGIT_MAP[c] ?? c)
    .replace(/٫/g, '.')
    .replace(/[٬,\s']/g, '');
  if (!s || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Plain string for an input field (no grouping), trimmed of float noise. */
export function toInput(v: number | null | undefined, maxDecimals = 8): string {
  if (v == null || !Number.isFinite(v)) return '';
  return String(Number(v.toFixed(maxDecimals)));
}
