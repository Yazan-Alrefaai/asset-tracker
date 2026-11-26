import { describe, expect, it } from 'vitest';
import { parseBinance, parseCoinGecko, parseErApi, parseGoldApi, parseSwissquote, parseYahoo } from './sources';

describe('price source parsers', () => {
  it('gold-api.com', () => {
    const q = parseGoldApi({ name: 'Gold', price: 3561.850098, symbol: 'XAU', updatedAt: '2026-11-26T08:33:17Z' }, 'XAU');
    expect(q).toMatchObject({ key: 'metal:XAU', price: 3561.850098, currency: 'USD', asOf: '2026-11-26T08:33:17Z' });
    expect(() => parseGoldApi({ error: 'x' }, 'XAU')).toThrow();
  });

  it('Swissquote uses the mid of the prime spread', () => {
    const q = parseSwissquote(
      [
        {
          ts: 1795640000000,
          spreadProfilePrices: [
            { spreadProfile: 'premium', bid: 3566.0, ask: 3567.0 },
            { spreadProfile: 'prime', bid: 3566.034, ask: 3566.696 },
          ],
        },
      ],
      'XAU',
    );
    expect(q.price).toBeCloseTo((3566.034 + 3566.696) / 2, 6);
    expect(q.bid).toBe(3566.034);
  });

  it('CoinGecko skips coins without a price', () => {
    const qs = parseCoinGecko({ bitcoin: { usd: 60598, usd_24h_change: -1.5 }, ethereum: {} }, ['bitcoin', 'ethereum']);
    expect(qs).toHaveLength(1);
    expect(qs[0]).toMatchObject({ key: 'crypto:bitcoin', price: 60598, extra: { change24h: -1.5 } });
  });

  it('Binance maps pairs back to CoinGecko ids', () => {
    const qs = parseBinance([{ symbol: 'BTCUSDT', price: '60618.36' }], { BTCUSDT: 'bitcoin' });
    expect(qs[0]).toMatchObject({ key: 'crypto:bitcoin', price: 60618.36 });
  });

  it('Yahoo reads the price, currency and name, and converts pence to pounds', () => {
    const spy = parseYahoo(
      { chart: { result: [{ meta: { currency: 'USD', regularMarketPrice: 716.7, longName: 'SPDR S&P 500', chartPreviousClose: 710, regularMarketTime: 1795640400 } }] } },
      'spy',
    );
    expect(spy).toMatchObject({ key: 'stock:SPY', price: 716.7, currency: 'USD', extra: { name: 'SPDR S&P 500', prevClose: 710 } });
    const lse = parseYahoo({ chart: { result: [{ meta: { currency: 'GBp', regularMarketPrice: 1234 } }] } }, 'VUSA.L');
    expect(lse.currency).toBe('GBP');
    expect(lse.price).toBeCloseTo(12.34, 6);
    expect(() => parseYahoo({ chart: { result: null, error: { description: 'No data found' } } }, 'X')).toThrow(/No data/);
  });

  it('ExchangeRate-API returns units per USD', () => {
    const qs = parseErApi({ result: 'success', time_last_update_unix: 1795564951, rates: { USD: 1, EUR: 0.914, SYP: 121.53 } }, ['EUR', 'SYP', 'XXX']);
    expect(qs.map((q) => q.key)).toEqual(['fx:EUR', 'fx:SYP']);
    expect(() => parseErApi({ result: 'error' }, ['EUR'])).toThrow();
  });
});
