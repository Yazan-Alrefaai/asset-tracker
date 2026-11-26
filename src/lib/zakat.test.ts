import { describe, expect, it } from 'vitest';
import { computeHolding } from './calc/portfolio';
import { asset, market, tx } from './test-fixtures';
import { computeZakat, defaultIncluded, NISAB_GOLD_GRAMS, NISAB_SILVER_GRAMS, ZAKAT_RATE } from './zakat';

const base = { basis: 'gold' as const, includeJewelry: true, overrides: {}, debts: 0, debtsCurrency: 'USD' };

function holdingsFor(...pairs: [ReturnType<typeof asset>, number][]) {
  const m = market();
  return pairs.map(([a, qty]) => computeHolding(a, [tx(a, { quantity: qty, price: 1 })], m));
}

describe('nisab', () => {
  it('uses 85 g of the Syrian 24K price for gold and 595 g of world silver', () => {
    const m = market();
    const z = computeZakat([], m, base);
    expect(z.nisab.gold.syp).toBeCloseTo(17950 * NISAB_GOLD_GRAMS, 6);
    expect(z.nisab.gold.usd).toBeCloseTo((17950 * NISAB_GOLD_GRAMS) / 153, 6);
    expect(z.nisab.silver.usd).toBeCloseTo((41.37 / 31.1034768) * NISAB_SILVER_GRAMS, 6);
    expect(z.nisabUsd).toBe(z.nisab.gold.usd);
  });

  it('uses the world gold price when world pricing is chosen', () => {
    const z = computeZakat([], market({ metalPricing: 'global' }), base);
    expect(z.nisab.gold.usd).toBeCloseTo((3575.1 / 31.1034768) * NISAB_GOLD_GRAMS, 6);
  });

  it('says "unknown" while there are no metal prices', () => {
    const z = computeZakat([], market({ xau: null, xag: null, localGold: {} }), base);
    expect(z.nisabUsd).toBeNull();
    expect(z.reachesNisab).toBeNull();
    expect(z.dueUsd).toBe(0);
  });
});

describe('zakat due', () => {
  it('is 2.5% of everything zakatable when it reaches the nisab', () => {
    const cash = asset({ type: 'cash', symbol: 'USD' });
    const z = computeZakat(holdingsFor([cash, 20_000]), market(), base);
    expect(z.reachesNisab).toBe(true);
    expect(z.totalUsd).toBe(20_000);
    expect(z.dueUsd).toBeCloseTo(20_000 * ZAKAT_RATE, 6);
    expect(z.dueSyp).toBeCloseTo(20_000 * 152.5 * ZAKAT_RATE, 6);
  });

  it('is zero below the nisab', () => {
    const cash = asset({ type: 'cash', symbol: 'USD' });
    const z = computeZakat(holdingsFor([cash, 1_000]), market(), base);
    expect(z.reachesNisab).toBe(false);
    expect(z.dueUsd).toBe(0);
    expect(z.dueSyp).toBe(0);
  });

  it('can reach the lower silver nisab when gold would not', () => {
    const cash = asset({ type: 'cash', symbol: 'USD' });
    const h = holdingsFor([cash, 2_000]);
    expect(computeZakat(h, market(), base).reachesNisab).toBe(false);
    expect(computeZakat(h, market(), { ...base, basis: 'silver' }).reachesNisab).toBe(true);
  });

  it('subtracts debts first, in any currency', () => {
    const cash = asset({ type: 'cash', symbol: 'USD' });
    const z = computeZakat(holdingsFor([cash, 20_000]), market(), { ...base, debts: 153_000, debtsCurrency: 'SYP' });
    expect(z.debtsUsd).toBeCloseTo(1000, 6);
    expect(z.netUsd).toBeCloseTo(19_000, 6);
    expect(z.dueUsd).toBeCloseTo(19_000 * ZAKAT_RATE, 6);
  });

  it('never goes negative when debts are bigger than wealth', () => {
    const cash = asset({ type: 'cash', symbol: 'USD' });
    const z = computeZakat(holdingsFor([cash, 500]), market(), { ...base, debts: 10_000 });
    expect(z.netUsd).toBe(0);
    expect(z.reachesNisab).toBe(false);
  });
});

describe('what counts', () => {
  const ring = asset({ type: 'gold', symbol: 'XAU', unit: 'g', unitGrams: 1, purity: 21 / 24, form: 'jewelry' });
  const bar = asset({ type: 'gold', symbol: 'XAU', unit: 'g', unitGrams: 1, purity: 1, form: 'bar' });
  const car = asset({ type: 'manual', name: 'Car', manualPrice: 8000, priceCurrency: 'USD' });

  it('counts money, gold, crypto and stocks, but not a car by default', () => {
    expect(defaultIncluded(bar, true)).toBe(true);
    expect(defaultIncluded(car, true)).toBe(false);
    const z = computeZakat(holdingsFor([bar, 100], [car, 1]), market(), base);
    const carRow = z.rows.find((r) => r.holding.asset.id === car.id)!;
    expect(carRow).toMatchObject({ included: false, reason: 'type' });
  });

  it('leaves out worn jewelry when the user chooses that', () => {
    const z = computeZakat(holdingsFor([ring, 100], [bar, 100]), market(), { ...base, includeJewelry: false });
    expect(z.rows.find((r) => r.holding.asset.id === ring.id)).toMatchObject({ included: false, reason: 'jewelry' });
    expect(z.totalSyp).toBeCloseTo(100 * 17950, 6);
  });

  it('lets the user switch any asset on or off', () => {
    const z = computeZakat(holdingsFor([bar, 100], [car, 1]), market(), {
      ...base,
      overrides: { [String(bar.id)]: false, [String(car.id)]: true },
    });
    expect(z.rows.find((r) => r.holding.asset.id === bar.id)).toMatchObject({ included: false, reason: 'override' });
    expect(z.rows.find((r) => r.holding.asset.id === car.id)).toMatchObject({ included: true, reason: 'override' });
    expect(z.totalUsd).toBeCloseTo(8000, 6);
  });

  it('gives zakat in kind: 2.5% of the pure gold grams', () => {
    const z = computeZakat(holdingsFor([ring, 100], [bar, 100]), market(), base);
    expect(z.reachesNisab).toBe(true);
    expect(z.goldGramsDue).toBeCloseTo((100 * 0.875 + 100) * ZAKAT_RATE, 6);
  });

  it('skips assets that have no price yet instead of counting them as zero', () => {
    const coin = asset({ type: 'crypto', symbol: 'unknown-coin' });
    const z = computeZakat(holdingsFor([coin, 5]), market(), base);
    expect(z.rows[0]).toMatchObject({ included: false, reason: 'noPrice' });
  });
});
