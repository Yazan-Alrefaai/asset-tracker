import type { Quote } from '../model';
import type { Settings } from '../settings';

export interface BuySell {
  buy: number;
  sell: number;
}

/** Everything the calculations need to know about current prices. */
export interface Market {
  /** New SYP the market pays you for 1 USD (exchange "buy"). Used to show values in SYP. */
  sypBuy: number | null;
  /** New SYP you pay for 1 USD (exchange "sell"). Used to turn SYP into USD. */
  sypSell: number | null;
  sypSource: 'sptoday' | 'manual' | 'none';
  sypAsOf: string | null;
  /** International rates: units of CODE per 1 USD. */
  fx: Record<string, number>;
  /** Syrian market: new SYP per 1 unit of CODE. */
  sypPer: Record<string, BuySell>;
  /** USD per troy ounce. */
  xau: number | null;
  xag: number | null;
  /** Syrian market gold: new SYP per gram, by karat label ("21K"). */
  localGold: Record<string, BuySell>;
  crypto: Record<string, number>;
  stocks: Record<string, { price: number; currency: string }>;
  metalPricing: 'local' | 'global';
}

export function splitKey(key: string): [string, string] {
  const i = key.indexOf(':');
  return i < 0 ? [key, ''] : [key.slice(0, i), key.slice(i + 1)];
}

export function buildMarket(quotes: Record<string, Quote>, s: Settings): Market {
  const m: Market = {
    sypBuy: null,
    sypSell: null,
    sypSource: 'none',
    sypAsOf: null,
    fx: {},
    sypPer: {},
    xau: null,
    xag: null,
    localGold: {},
    crypto: {},
    stocks: {},
    metalPricing: s.metalPricing,
  };
  for (const q of Object.values(quotes)) {
    const [kind, id] = splitKey(q.key);
    switch (kind) {
      case 'metal':
        if (id === 'XAU') m.xau = q.price;
        else if (id === 'XAG') m.xag = q.price;
        break;
      case 'fx':
        m.fx[id] = q.price;
        break;
      case 'syp':
        m.sypPer[id] = { buy: q.bid ?? q.price, sell: q.ask ?? q.price };
        break;
      case 'sygold':
        m.localGold[id] = { buy: q.bid ?? q.price, sell: q.ask ?? q.price };
        break;
      case 'crypto':
        m.crypto[id] = q.price;
        break;
      case 'stock':
        m.stocks[id] = { price: q.price, currency: q.currency };
        break;
    }
  }
  const manualBuy = s.sypManualBuy && s.sypManualBuy > 0 ? s.sypManualBuy : null;
  if (s.sypSource === 'manual' && manualBuy) {
    m.sypBuy = manualBuy;
    m.sypSell = s.sypManualSell && s.sypManualSell > 0 ? s.sypManualSell : manualBuy;
    m.sypSource = 'manual';
  } else if (m.sypPer.USD) {
    m.sypBuy = m.sypPer.USD.buy;
    m.sypSell = m.sypPer.USD.sell;
    m.sypSource = 'sptoday';
    m.sypAsOf = quotes['syp:USD']?.asOf ?? quotes['syp:USD']?.fetchedAt ?? null;
  }
  return m;
}

/** How many USD 1 unit of `currency` is worth (SYP converts at the market sell rate). */
export function usdPerUnit(m: Market, currency: string): number | null {
  if (currency === 'USD') return 1;
  if (currency === 'SYP') return m.sypSell ? 1 / m.sypSell : null;
  const r = m.fx[currency];
  if (r && r > 0) return 1 / r;
  const sp = m.sypPer[currency];
  if (sp && m.sypSell) return sp.buy / m.sypSell;
  return null;
}

/** USD amount shown in SYP at the market buy rate (what you would get for the dollars). */
export function usdToSyp(m: Market, usd: number | null): number | null {
  return usd == null || m.sypBuy == null ? null : usd * m.sypBuy;
}

/** Current SYP per 1 unit of `currency`, for pre-filling forms. */
export function sypPerUnitNow(m: Market, currency: string): number | null {
  if (currency === 'SYP') return 1;
  if (currency === 'USD') return m.sypSell;
  if (m.sypPer[currency]) return m.sypPer[currency].sell;
  const usd = usdPerUnit(m, currency);
  return usd != null && m.sypSell ? usd * m.sypSell : null;
}

/** Current units of `currency` per 1 USD, for pre-filling forms. */
export function unitsPerUsdNow(m: Market, currency: string): number | null {
  if (currency === 'USD') return 1;
  if (currency === 'SYP') return m.sypSell;
  const usd = usdPerUnit(m, currency);
  return usd ? 1 / usd : null;
}
