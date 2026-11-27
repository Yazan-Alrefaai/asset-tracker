import { TROY_OUNCE_GRAMS, karatLabel } from '../catalog';
import type { Asset } from '../model';
import { type Market, unitsPerUsdNow, usdPerUnit, usdToSyp } from './market';

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

/**
 * Today's price of ONE unit for a trade, in `currency`, for filling the buy/sell form:
 * a buy uses the price sellers ask (Syrian market "sell"), a sell uses the price buyers pay ("buy").
 * Returns null when there is no price yet.
 */
export function liveTradePrice(a: Asset, m: Market, side: 'buy' | 'sell', currency: string): number | null {
  const pick = (q: { buy: number; sell: number }) => (side === 'buy' ? q.sell : q.buy);
  let base: { cur: string; v: number } | null = null;

  if ((a.type === 'manual' || a.useManualPrice) && a.manualPrice != null) {
    base = { cur: a.priceCurrency || 'USD', v: a.manualPrice };
  } else if (a.type === 'gold' && m.metalPricing === 'local') {
    const purity = a.purity ?? 1;
    const label = karatLabel(purity);
    const q = label ? m.localGold[label] : undefined;
    const k24 = m.localGold['24K'];
    const perGram = q ? pick(q) : k24 ? pick(k24) * purity : null;
    if (perGram != null) base = { cur: 'SYP', v: perGram * (a.unitGrams ?? 1) };
  } else if (a.type === 'cash') {
    if (a.symbol === currency) return 1;
    const sp =
      a.symbol === 'USD'
        ? m.sypBuy != null
          ? { buy: m.sypBuy, sell: m.sypSell ?? m.sypBuy }
          : undefined
        : m.sypPer[a.symbol];
    if (currency === 'SYP' && sp) return pick(sp);
  }
  if (!base) {
    const u = unitValue(a, m);
    base = u.usd != null ? { cur: 'USD', v: u.usd } : u.syp != null ? { cur: 'SYP', v: u.syp } : null;
  }
  if (!base) return null;
  if (base.cur === currency) return base.v;

  // Through US dollars: SYP converts at the market sell rate (as everywhere in the app).
  const usd = base.cur === 'USD' ? base.v : base.cur === 'SYP' ? (m.sypSell ? base.v / m.sypSell : null) : mulOrNull(base.v, usdPerUnit(m, base.cur));
  if (usd == null) return null;
  if (currency === 'USD') return usd;
  if (currency === 'SYP') return mulOrNull(usd, side === 'buy' ? m.sypSell : m.sypBuy);
  return mulOrNull(usd, unitsPerUsdNow(m, currency));
}

const mulOrNull = (a: number, b: number | null | undefined): number | null => (b == null || !(b > 0) ? null : a * b);

/** World (spot) value of one gram of gold/silver at a given fineness, in USD. */
export function spotPerGram(spotPerOz: number | null, purity: number): number | null {
  return spotPerOz == null ? null : (spotPerOz / TROY_OUNCE_GRAMS) * purity;
}
