import { describe, expect, it } from 'vitest';
import { ar } from '../i18n/ar';
import { en } from '../i18n/en';
import { market } from './test-fixtures';
import { trayTitle, trayTooltip } from './tray';

const totals = { usd: 2016.34, syp: 308_000 };
const opts = { privacy: false, mainCurrency: 'USD' as const, spy: 716.7 };

describe('menu bar text', () => {
  it('shows the chosen prices in short form', () => {
    expect(trayTitle(['usd', 'gold21', 'btc'], market(), totals, opts)).toBe('USD 152.5 · 21K 15,550 · BTC 60.9K');
    expect(trayTitle(['xau', 'xag', 'spy', 'gold24'], market(), totals, opts)).toBe('XAU 3,575 · XAG 41.37 · SPY 717 · 24K 17,950');
  });

  it('shows the total in the main currency, and hides it in privacy mode', () => {
    expect(trayTitle(['total'], market(), totals, opts)).toBe('Σ $2K');
    expect(trayTitle(['total'], market(), totals, { ...opts, mainCurrency: 'SYP' })).toBe('Σ 308K SYP');
    expect(trayTitle(['total'], market(), totals, { ...opts, privacy: true })).toBe('Σ •••');
  });

  it('skips items that have no price yet', () => {
    const empty = market({ sypBuy: null, sypSell: null, localGold: {}, xau: null, crypto: {} });
    expect(trayTitle(['usd', 'gold21', 'btc'], empty, totals, opts)).toBe('');
  });

  it('uses the world price in SYP when the Syrian 21K price is missing', () => {
    const m = market({ localGold: {} });
    const expected = Math.round((3575.1 / 31.1034768) * 0.875 * 152.5);
    expect(trayTitle(['gold21'], m, totals, opts)).toBe(`21K ${expected.toLocaleString('en-US')}`);
  });
});

describe('tray tooltip', () => {
  it('lists the prices in the app language', () => {
    const tip = trayTooltip(['usd', 'gold21', 'btc'], market(), totals, en, opts);
    expect(tip.split('\n')).toEqual(['Asset Tracker', 'USD→SYP 152.50 / 153.00', 'Gold 21K: 15,550 SYP/g', 'BTC: $60,889']);
    expect(trayTooltip(['gold21'], market(), totals, ar, opts)).toContain('الذهب');
  });

  it('stays within the Windows tooltip limit', () => {
    const tip = trayTooltip(['usd', 'gold21', 'gold24', 'xau', 'xag', 'btc', 'spy', 'total'], market(), totals, ar, opts);
    expect(tip.length).toBeLessThanOrEqual(120);
  });

  it('hides the total in privacy mode', () => {
    expect(trayTooltip(['total'], market(), totals, en, { ...opts, privacy: true })).toContain('•••');
  });
});
