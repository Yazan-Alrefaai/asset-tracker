/** Shared helpers for unit tests (not used by the app). */
import type { Market } from './calc/market';
import type { Alert, Asset, Tx } from './model';

export function market(over: Partial<Market> = {}): Market {
  return {
    sypBuy: 152.5,
    sypSell: 153,
    sypSource: 'sptoday',
    sypAsOf: null,
    fx: { EUR: 0.9125 },
    sypPer: { USD: { buy: 152.5, sell: 153 }, EUR: { buy: 165.9, sell: 167.8 } },
    xau: 3575.1,
    xag: 41.37,
    localGold: { '24K': { buy: 17950, sell: 18250 }, '21K': { buy: 15550, sell: 15850 } },
    crypto: { bitcoin: 60889 },
    stocks: { SPY: { price: 716.7, currency: 'USD' } },
    metalPricing: 'local',
    ...over,
  };
}

let seq = 1000;

export function asset(over: Partial<Asset>): Asset {
  return {
    id: seq++,
    portfolioId: 1,
    type: 'cash',
    name: 'x',
    symbol: 'USD',
    unit: 'unit',
    unitGrams: null,
    purity: null,
    form: '',
    priceCurrency: null,
    manualPrice: null,
    useManualPrice: false,
    location: '',
    notes: '',
    archived: false,
    createdAt: '',
    ...over,
  };
}

export function tx(a: Asset, over: Partial<Tx>): Tx {
  return {
    id: seq++,
    assetId: a.id,
    kind: 'buy',
    date: '2026-01-10',
    quantity: 1,
    price: 1,
    currency: 'USD',
    fees: 0,
    usdRate: 1,
    sypRate: 150,
    notes: '',
    createdAt: '',
    ...over,
  };
}

export function alert(over: Partial<Alert>): Alert {
  return {
    id: seq++,
    target: 'metal:XAU',
    condition: 'above',
    value: 3600,
    repeat: false,
    active: true,
    state: 'armed',
    note: '',
    lastTriggeredAt: null,
    lastValue: null,
    createdAt: '',
    ...over,
  };
}
