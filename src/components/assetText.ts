import type { Messages } from '../i18n/en';
import { coinById, currencyInfo, karatLabel } from '../lib/catalog';
import type { Asset } from '../lib/model';
import type { Language } from '../lib/settings';

/** Short label for one unit of the asset: g, oz, coin, BTC, share, USD… */
export function unitLabel(a: Asset, t: Messages): string {
  switch (a.type) {
    case 'gold':
    case 'silver':
      return t.units[a.unit as 'g' | 'oz' | 'kg' | 'coin'] ?? a.unit;
    case 'crypto':
      return coinById(a.symbol)?.symbol ?? a.symbol.toUpperCase();
    case 'stock':
      return t.units.share;
    case 'cash':
      return a.symbol;
    default:
      return t.units.unit;
  }
}

/** One line of details under the asset name. */
export function assetDetails(a: Asset, t: Messages, lang: Language): string {
  const parts: string[] = [];
  if (a.type === 'gold') {
    const k = karatLabel(a.purity);
    if (k) parts.push(lang === 'ar' ? `${t.assetForm.karat} ${k.replace('K', '')}` : k);
  }
  if (a.type === 'silver' && a.purity) parts.push(String(Math.round(a.purity * 1000)));
  if ((a.type === 'gold' || a.type === 'silver') && a.form) {
    parts.push({ jewelry: t.assetForm.formJewelry, bar: t.assetForm.formBar, coin: t.assetForm.formCoin }[a.form]);
  }
  if ((a.type === 'gold' || a.type === 'silver') && a.unit === 'coin' && a.unitGrams) {
    parts.push(`${Math.round(a.unitGrams * 1000) / 1000} ${t.units.g}`);
  }
  if (a.type === 'crypto') parts.push(coinById(a.symbol)?.symbol ?? a.symbol);
  if (a.type === 'stock') parts.push(a.symbol.toUpperCase());
  if (a.type === 'cash') {
    const c = currencyInfo(a.symbol);
    parts.push(c ? (lang === 'ar' ? c.ar : c.en) : a.symbol);
  }
  if (a.location) parts.push(a.location);
  return parts.join(' · ');
}

export function currencyName(code: string, lang: Language): string {
  const c = currencyInfo(code);
  return c ? `${code} · ${lang === 'ar' ? c.ar : c.en}` : code;
}
