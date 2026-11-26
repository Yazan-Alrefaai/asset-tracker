import { TROY_OUNCE_GRAMS, karatLabel } from '../catalog';
import type { Asset } from '../model';
import { type Market, usdPerUnit, usdToSyp } from './market';

export type ValueBasis = 'manual' | 'local' | 'world' | 'live' | 'none';

/** Value of ONE unit of an asset (one gram, one coin, one BTC, one share, one dollar…). */
export interface UnitValue {
  usd: number | null;
  syp: number | null;
  basis: ValueBasis;
}

const NONE: UnitValue = { usd: null, syp: null, basis: 'none' };

function fromUsd(m: Market, usd: number | null, basis: ValueBasis): UnitValue {
  return usd == null ? NONE : { usd, syp: usdToSyp(m, usd), basis };
}

function fromSyp(m: Market, syp: number, basis: ValueBasis): UnitValue {
  return { syp, usd: m.sypSell ? syp / m.sypSell : null, basis };
}

export function unitValue(a: Asset, m: Market): UnitValue {
  if ((a.type === 'manual' || a.useManualPrice) && a.manualPrice != null) {
    const cur = a.priceCurrency || 'USD';
    if (cur === 'SYP') return fromSyp(m, a.manualPrice, 'manual');
    const k = usdPerUnit(m, cur);
    return k == null ? NONE : fromUsd(m, a.manualPrice * k, 'manual');
  }
  switch (a.type) {
    case 'gold':
    case 'silver':
      return metalValue(a, m);
    case 'crypto':
      return fromUsd(m, m.crypto[a.symbol] ?? null, 'live');
    case 'stock': {
      const q = m.stocks[a.symbol.toUpperCase()];
      if (!q) return NONE;
      const k = usdPerUnit(m, q.currency);
      return k == null ? NONE : fromUsd(m, q.price * k, 'live');
    }
    case 'cash':
      return cashValue(a.symbol, m);
    default:
      return NONE;
  }
}

function metalValue(a: Asset, m: Market): UnitValue {
  const grams = a.unitGrams ?? 1;
  const purity = a.purity ?? 1;
  if (a.type === 'gold' && m.metalPricing === 'local') {
    const label = karatLabel(purity);
    let sypPerGram: number | null = null;
    if (label && m.localGold[label]) sypPerGram = m.localGold[label].buy;
    else if (m.localGold['24K']) sypPerGram = m.localGold['24K'].buy * purity;
    if (sypPerGram != null) return fromSyp(m, sypPerGram * grams, 'local');
  }
  const spot = a.type === 'gold' ? m.xau : m.xag;
  if (spot == null) return NONE;
  return fromUsd(m, ((grams * purity) / TROY_OUNCE_GRAMS) * spot, 'world');
}

function cashValue(code: string, m: Market): UnitValue {
  if (code === 'USD') return { usd: 1, syp: m.sypBuy, basis: 'live' };
  if (code === 'SYP') return { usd: m.sypSell ? 1 / m.sypSell : null, syp: 1, basis: 'live' };
  const usd = usdPerUnit(m, code);
  const syp = m.sypPer[code]?.buy ?? usdToSyp(m, usd);
  return usd == null && syp == null ? NONE : { usd, syp, basis: 'live' };
}

/** World (spot) value of one gram of gold/silver at a given fineness, in USD. */
export function spotPerGram(spotPerOz: number | null, purity: number): number | null {
  return spotPerOz == null ? null : (spotPerOz / TROY_OUNCE_GRAMS) * purity;
}
