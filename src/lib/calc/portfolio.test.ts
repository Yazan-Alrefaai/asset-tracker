import { describe, expect, it } from 'vitest';
import type { Asset, Tx } from '../model';
import type { Market } from './market';
import { computeHolding, summarize, txOutcomes, vsAverageCost } from './portfolio';
import { unitValue } from './valuation';

function market(over: Partial<Market> = {}): Market {
  return {
    sypBuy: 152.25,
    sypSell: 152.75,
    sypSource: 'sptoday',
    sypAsOf: null,
    fx: { EUR: 0.9 },
    sypPer: { USD: { buy: 152.25, sell: 152.75 }, EUR: { buy: 165.6, sell: 167.5 } },
    xau: 3561.85,
    xag: 41.1,
    localGold: { '24K': { buy: 17950, sell: 18250 }, '21K': { buy: 15550, sell: 15850 } },
    crypto: { bitcoin: 60000 },
    stocks: { SPY: { price: 700, currency: 'USD' } },
    metalPricing: 'local',
    ...over,
  };
}

let nextId = 1;
function asset(over: Partial<Asset>): Asset {
  return {
    id: nextId++,
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

function tx(a: Asset, over: Partial<Tx>): Tx {
  return {
    id: nextId++,
    assetId: a.id,
    kind: 'buy',
    date: '2026-01-10',
    quantity: 1,
    price: 1,
    currency: 'USD',
    fees: 0,
    usdRate: 1,
    sypRate: null,
    notes: '',
    createdAt: '',
    ...over,
  };
}

describe('dollars bought with Syrian pounds', () => {
  const usd = asset({ type: 'cash', symbol: 'USD' });
  const txs = [tx(usd, { quantity: 1000, price: 152.75, currency: 'SYP', usdRate: 152.75, sypRate: 152.75 })];
  const h = computeHolding(usd, txs, market());

  it('keeps the cost in both currencies', () => {
    expect(h.quantity).toBe(1000);
    expect(h.costUsd).toBeCloseTo(1000, 6);
    expect(h.costSyp).toBeCloseTo(152_750, 6);
  });

  it('values dollars at the exchange buy rate, so the spread shows as a small SYP loss', () => {
    expect(h.valueUsd).toBe(1000);
    expect(h.valueSyp).toBeCloseTo(152_250, 6);
    expect(h.pnlUsd).toBeCloseTo(0, 6);
    expect(h.pnlSyp).toBeCloseTo(-500, 6);
  });
});

describe('gold 21K jewelry', () => {
  const gold = asset({ type: 'gold', symbol: 'XAU', unit: 'g', unitGrams: 1, purity: 21 / 24, form: 'jewelry' });
  // 10 g at 15,000 SYP/g plus 50,000 SYP making charge, when 1 USD = 150 SYP
  const txs = [tx(gold, { quantity: 10, price: 15_000, fees: 50_000, currency: 'SYP', usdRate: 150, sypRate: 150 })];

  it('counts the making charge in the cost', () => {
    const h = computeHolding(gold, txs, market());
    expect(h.costSyp).toBeCloseTo(200_000, 6);
    expect(h.costUsd).toBeCloseTo(200_000 / 150, 6);
  });

  it('uses the Syrian market price per karat when local pricing is on', () => {
    const h = computeHolding(gold, txs, market());
    expect(h.unit.basis).toBe('local');
    expect(h.valueSyp).toBeCloseTo(155_500, 6);
    expect(h.valueUsd).toBeCloseTo(155_500 / 152.75, 6);
  });

  it('uses the world price with purity when global pricing is on', () => {
    const h = computeHolding(gold, txs, market({ metalPricing: 'global' }));
    const expectedUsd = ((10 * 0.875) / 31.1034768) * 3561.85;
    expect(h.unit.basis).toBe('world');
    expect(h.valueUsd).toBeCloseTo(expectedUsd, 6);
    expect(h.valueSyp).toBeCloseTo(expectedUsd * 152.25, 4);
  });

  it('falls back to 24K × purity for karats the market does not list', () => {
    const g18 = asset({ type: 'gold', symbol: 'XAU', unit: 'g', unitGrams: 1, purity: 18 / 24 });
    expect(unitValue(g18, market()).syp).toBeCloseTo(17_950 * 0.75, 6);
  });

  it('values coins by their weight', () => {
    const coin = asset({ type: 'gold', symbol: 'XAU', unit: 'coin', unitGrams: 8, purity: 21 / 24 });
    expect(unitValue(coin, market()).syp).toBeCloseTo(8 * 15_550, 6);
  });
});

describe('average cost and sales', () => {
  const btc = asset({ type: 'crypto', symbol: 'bitcoin' });
  const txs = [
    tx(btc, { date: '2026-01-01', quantity: 1, price: 50_000 }),
    tx(btc, { date: '2026-02-01', quantity: 1, price: 70_000 }),
    tx(btc, { date: '2026-03-01', kind: 'sell', quantity: 1, price: 65_000, fees: 100 }),
  ];

  it('uses the average cost for the part that was sold', () => {
    const h = computeHolding(btc, txs, market());
    expect(h.quantity).toBe(1);
    expect(h.costUsd).toBeCloseTo(60_000, 6);
    expect(h.realizedUsd).toBeCloseTo(64_900 - 60_000, 6);
    expect(h.avgCostUsd).toBeCloseTo(60_000, 6);
    expect(h.pnlUsd).toBeCloseTo(0, 6);
    expect(h.oversold).toBe(false);
  });

  it('flags a sale bigger than the holding', () => {
    const h = computeHolding(btc, [tx(btc, { quantity: 1, price: 1 }), tx(btc, { kind: 'sell', quantity: 2, price: 1, date: '2026-01-11' })], market());
    expect(h.oversold).toBe(true);
    expect(h.quantity).toBe(0);
  });

  it('leaves SYP figures empty when the SYP rate of a purchase is unknown', () => {
    const h = computeHolding(btc, txs, market());
    expect(h.costSyp).toBeNull();
    expect(h.pnlSyp).toBeNull();
  });
});

describe('summary', () => {
  it('adds holdings, splits by type in palette order and counts missing prices', () => {
    const m = market();
    const cash = asset({ type: 'cash', symbol: 'USD' });
    const spy = asset({ type: 'stock', symbol: 'SPY' });
    const unknown = asset({ type: 'stock', symbol: 'NOPE' });
    const hs = [
      computeHolding(cash, [tx(cash, { quantity: 300, price: 1, sypRate: 150 })], m),
      computeHolding(spy, [tx(spy, { quantity: 1, price: 600, sypRate: 150 })], m),
      computeHolding(unknown, [tx(unknown, { quantity: 1, price: 10, sypRate: 150 })], m),
    ];
    const s = summarize(hs);
    expect(s.valueUsd).toBeCloseTo(1000, 6);
    expect(s.missing).toBe(1);
    expect(s.slices.map((x) => x.type)).toEqual(['stock', 'cash']);
    expect(s.slices[0].share).toBeCloseTo(0.7, 6);
    expect(s.pnlUsd).toBeCloseTo(100, 6);
    expect(s.pnlPct).toBeCloseTo(100 / 900, 6);
  });
});

describe('profit or loss of each transaction', () => {
  it('shows a buy against today’s price (the 31 g gold bar example)', () => {
    // 24K bar, 31 g, paid $4,350 when 1 USD = 153.50 SYP. Today the market pays 17,950 SYP/g and sells USD at 153.50.
    const m = market({ sypBuy: 153, sypSell: 153.5 });
    const bar = asset({ type: 'gold', symbol: 'XAU', unit: 'g', unitGrams: 1, purity: 1, form: 'bar' });
    const buy = tx(bar, { quantity: 31, price: 4350 / 31, currency: 'USD', usdRate: 1, sypRate: 153.5, date: '2026-09-24' });
    const o = txOutcomes(bar, [buy], m).get(buy.id)!;
    expect(o.pnlUsd).toBeCloseTo((31 * 17950) / 153.5 - 4350, 6); // ≈ -724.92
    expect(o.pnlUsd!).toBeCloseTo(-724.92, 2);
    expect(o.pctUsd!).toBeCloseTo(-0.1666, 4);
    expect(o.pnlSyp).toBeCloseTo(31 * 17950 - 4350 * 153.5, 6); // -111,275
    expect(o.pnlSyp).toBe(-111_275);

    // Same numbers per gram: price now vs what you paid per gram.
    const per = vsAverageCost(computeHolding(bar, [buy], m));
    expect(per.pnlUsd!).toBeCloseTo(17950 / 153.5 - 4350 / 31, 9); // ≈ -23.38
    expect(per.pnlUsd!).toBeCloseTo(-23.38, 2);
    expect(per.pctUsd!).toBeCloseTo(o.pctUsd!, 12);
    expect(per.pnlSyp!).toBeCloseTo(17950 - (4350 * 153.5) / 31, 9);
  });

  it('gives each buy its own result and counts fees as cost', () => {
    const m = market();
    const spy = asset({ type: 'stock', symbol: 'SPY', unit: 'unit' });
    const cheap = tx(spy, { quantity: 2, price: 500, fees: 10, date: '2026-01-01' });
    const dear = tx(spy, { quantity: 1, price: 800, date: '2026-02-01' });
    const out = txOutcomes(spy, [dear, cheap], m);
    expect(out.get(cheap.id)).toMatchObject({ pnlUsd: 2 * 700 - 1010 });
    expect(out.get(cheap.id)!.pctUsd).toBeCloseTo(390 / 1010, 12);
    expect(out.get(dear.id)).toMatchObject({ pnlUsd: -100, pctUsd: -0.125 });
    // No SYP rate on those days → no SYP result, but USD still works.
    expect(out.get(dear.id)!.pnlSyp).toBeNull();
  });

  it('gives each sell the profit it took, matching the asset total', () => {
    const m = market();
    const spy = asset({ type: 'stock', symbol: 'SPY', unit: 'unit' });
    const list = [
      tx(spy, { quantity: 10, price: 100, date: '2026-01-01', sypRate: 150 }),
      tx(spy, { quantity: 10, price: 200, date: '2026-02-01', sypRate: 150 }),
      tx(spy, { kind: 'sell', quantity: 5, price: 180, fees: 0, date: '2026-03-01', sypRate: 160 }),
      tx(spy, { kind: 'sell', quantity: 5, price: 120, fees: 0, date: '2026-04-01', sypRate: 160 }),
    ];
    const out = txOutcomes(spy, list, m);
    const [, , sell1, sell2] = list;
    // average cost 150 → +30 and −30 per share
    expect(out.get(sell1.id)).toMatchObject({ pnlUsd: 150, pctUsd: 0.2 });
    expect(out.get(sell2.id)).toMatchObject({ pnlUsd: -150, pctUsd: -0.2 });
    // SYP uses each day's rate: proceeds at 160, cost at 150
    expect(out.get(sell1.id)!.pnlSyp).toBeCloseTo(5 * 180 * 160 - 750 * 150, 6);
    const h = computeHolding(spy, list, m);
    expect(out.get(sell1.id)!.pnlUsd! + out.get(sell2.id)!.pnlUsd!).toBeCloseTo(h.realizedUsd, 9);
  });

  it('has no result for a buy without a price today', () => {
    const coin = asset({ type: 'crypto', symbol: 'not-listed' });
    const buy = tx(coin, { quantity: 1, price: 5 });
    expect(txOutcomes(coin, [buy], market()).get(buy.id)).toEqual({ pnlUsd: null, pnlSyp: null, pctUsd: null, pctSyp: null });
    expect(vsAverageCost(computeHolding(coin, [buy], market())).pnlUsd).toBeNull();
  });

  it('has no average-cost comparison once everything is sold', () => {
    const spy = asset({ type: 'stock', symbol: 'SPY', unit: 'unit' });
    const list = [tx(spy, { quantity: 1, price: 100 }), tx(spy, { kind: 'sell', quantity: 1, price: 120, date: '2026-02-01' })];
    expect(vsAverageCost(computeHolding(spy, list, market()))).toEqual({ pnlUsd: null, pnlSyp: null, pctUsd: null, pctSyp: null });
  });
});
