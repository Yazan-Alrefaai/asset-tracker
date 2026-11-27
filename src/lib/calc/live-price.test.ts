import { describe, expect, it } from 'vitest';
import { TROY_OUNCE_GRAMS } from '../catalog';
import { asset, market } from '../test-fixtures';
import { liveTradePrice } from './valuation';

// Fixture market: USD→SYP 152.5 buy / 153 sell; 21K 15,550 buy / 15,850 sell; 24K 17,950 / 18,250;
// silver $41.37/oz; BTC $60,889; 1 USD = 0.9125 EUR.
const m = market();

describe('live price for the buy/sell form', () => {
  const gold21 = asset({ type: 'gold', symbol: 'XAU', unit: 'g', unitGrams: 1, purity: 0.875 });

  it('uses the Syrian market sell price for a buy and the buy price for a sell', () => {
    expect(liveTradePrice(gold21, m, 'buy', 'SYP')).toBe(15_850);
    expect(liveTradePrice(gold21, m, 'sell', 'SYP')).toBe(15_550);
  });

  it('converts to dollars and other currencies', () => {
    expect(liveTradePrice(gold21, m, 'buy', 'USD')).toBeCloseTo(15_850 / 153, 9);
    expect(liveTradePrice(gold21, m, 'buy', 'EUR')).toBeCloseTo((15_850 / 153) * 0.9125, 9);
  });

  it('prices coins by their weight, and karats without a quote from 24K', () => {
    const lira = asset({ type: 'gold', unit: 'coin', unitGrams: 8, purity: 0.875 });
    expect(liveTradePrice(lira, m, 'buy', 'SYP')).toBe(8 * 15_850);
    const k18 = asset({ type: 'gold', unit: 'g', unitGrams: 1, purity: 0.75 });
    expect(liveTradePrice(k18, m, 'sell', 'SYP')).toBeCloseTo(17_950 * 0.75, 9);
  });

  it('uses the world price for silver and when gold is valued at world prices', () => {
    const silver = asset({ type: 'silver', symbol: 'XAG', unit: 'g', unitGrams: 1, purity: 0.999 });
    expect(liveTradePrice(silver, m, 'buy', 'USD')).toBeCloseTo((41.37 / TROY_OUNCE_GRAMS) * 0.999, 12);
    // SYP for a buy goes through the rate you would pay for dollars
    expect(liveTradePrice(silver, m, 'buy', 'SYP')).toBeCloseTo((41.37 / TROY_OUNCE_GRAMS) * 0.999 * 153, 9);
    const worldGold = market({ metalPricing: 'global' });
    expect(liveTradePrice(gold21, worldGold, 'buy', 'USD')).toBeCloseTo((3575.1 / TROY_OUNCE_GRAMS) * 0.875, 9);
  });

  it('handles crypto, stocks, cash and your own price', () => {
    expect(liveTradePrice(asset({ type: 'crypto', symbol: 'bitcoin' }), m, 'buy', 'USD')).toBe(60_889);
    expect(liveTradePrice(asset({ type: 'crypto', symbol: 'bitcoin' }), m, 'sell', 'EUR')).toBeCloseTo(60_889 * 0.9125, 6);
    expect(liveTradePrice(asset({ type: 'stock', symbol: 'SPY' }), m, 'buy', 'USD')).toBe(716.7);
    const dollars = asset({ type: 'cash', symbol: 'USD' });
    expect(liveTradePrice(dollars, m, 'buy', 'SYP')).toBe(153);
    expect(liveTradePrice(dollars, m, 'sell', 'SYP')).toBe(152.5);
    expect(liveTradePrice(dollars, m, 'buy', 'USD')).toBe(1);
    const house = asset({ type: 'manual', manualPrice: 50_000, priceCurrency: 'USD' });
    expect(liveTradePrice(house, m, 'buy', 'USD')).toBe(50_000);
    expect(liveTradePrice(house, m, 'sell', 'SYP')).toBe(50_000 * 152.5);
  });

  it('has no price when the market has none yet', () => {
    const empty = market({ localGold: {}, xau: null, xag: null, crypto: {}, sypBuy: null, sypSell: null });
    expect(liveTradePrice(gold21, empty, 'buy', 'USD')).toBeNull();
    expect(liveTradePrice(asset({ type: 'crypto', symbol: 'unknown-coin' }), m, 'buy', 'USD')).toBeNull();
    expect(liveTradePrice(asset({ type: 'manual', manualPrice: null }), m, 'buy', 'USD')).toBeNull();
  });
});
