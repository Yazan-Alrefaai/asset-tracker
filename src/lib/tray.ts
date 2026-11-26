import type { Messages } from '../i18n/en';
import type { Totals } from './alerts';
import { TROY_OUNCE_GRAMS } from './catalog';
import { type Market, usdToSyp } from './calc/market';
import type { TrayItem } from './settings';

const en = (v: number, d = 0) =>
  new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(v);
const compact = (v: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(v);

/** Syrian-market gram price for a karat, falling back to the world price in SYP. */
function karatSyp(m: Market, karat: 21 | 24): number | null {
  const local = m.localGold[`${karat}K`]?.buy;
  if (local != null) return local;
  if (m.xau == null) return null;
  return usdToSyp(m, (m.xau / TROY_OUNCE_GRAMS) * (karat / 24));
}

/**
 * Short text for the macOS menu bar, e.g. "USD 152.5 · 21K 15,550 · BTC 60.9K".
 * Uses short Latin codes in every language so it stays narrow.
 */
export function trayTitle(
  items: TrayItem[],
  m: Market,
  totals: Totals,
  opts: { privacy: boolean; mainCurrency: 'USD' | 'SYP'; spy?: number | null },
): string {
  const parts: string[] = [];
  for (const item of items) {
    switch (item) {
      case 'usd':
        if (m.sypBuy != null) parts.push(`USD ${en(m.sypBuy, m.sypBuy < 1000 ? 1 : 0)}`);
        break;
      case 'gold21':
      case 'gold24': {
        const v = karatSyp(m, item === 'gold21' ? 21 : 24);
        if (v != null) parts.push(`${item === 'gold21' ? '21K' : '24K'} ${en(v)}`);
        break;
      }
      case 'xau':
        if (m.xau != null) parts.push(`XAU ${en(m.xau)}`);
        break;
      case 'xag':
        if (m.xag != null) parts.push(`XAG ${en(m.xag, 2)}`);
        break;
      case 'btc':
        if (m.crypto.bitcoin != null) parts.push(`BTC ${compact(m.crypto.bitcoin)}`);
        break;
      case 'spy':
        if (opts.spy != null) parts.push(`SPY ${en(opts.spy)}`);
        break;
      case 'total': {
        if (opts.privacy) {
          parts.push('Σ •••');
          break;
        }
        const syp = opts.mainCurrency === 'SYP' && totals.syp != null;
        const v = syp ? totals.syp : totals.usd;
        if (v != null) parts.push(syp ? `Σ ${compact(v)} SYP` : `Σ $${compact(v)}`);
        break;
      }
    }
  }
  return parts.join(' · ');
}

/** Longer hover text (Windows shows prices only here). Windows limits it to ~127 characters. */
export function trayTooltip(
  items: TrayItem[],
  m: Market,
  totals: Totals,
  t: Messages,
  opts: { privacy: boolean; spy?: number | null },
): string {
  const lines: string[] = [t.appName];
  for (const item of items) {
    switch (item) {
      case 'usd':
        if (m.sypBuy != null) lines.push(`USD→SYP ${en(m.sypBuy, 2)} / ${en(m.sypSell ?? m.sypBuy, 2)}`);
        break;
      case 'gold21':
      case 'gold24': {
        const v = karatSyp(m, item === 'gold21' ? 21 : 24);
        if (v != null) lines.push(`${t.types.gold} ${item === 'gold21' ? '21K' : '24K'}: ${en(v)} SYP/g`);
        break;
      }
      case 'xau':
        if (m.xau != null) lines.push(`${t.types.gold}: $${en(m.xau, 2)}/oz`);
        break;
      case 'xag':
        if (m.xag != null) lines.push(`${t.types.silver}: $${en(m.xag, 2)}/oz`);
        break;
      case 'btc':
        if (m.crypto.bitcoin != null) lines.push(`BTC: $${en(m.crypto.bitcoin)}`);
        break;
      case 'spy':
        if (opts.spy != null) lines.push(`SPY: $${en(opts.spy, 2)}`);
        break;
      case 'total':
        if (opts.privacy) lines.push(`${t.dashboard.totalValue}: •••`);
        else if (totals.usd != null) lines.push(`${t.dashboard.totalValue}: $${en(totals.usd)}`);
        break;
    }
  }
  const text = lines.join('\n');
  return text.length > 120 ? `${text.slice(0, 119)}…` : text;
}
