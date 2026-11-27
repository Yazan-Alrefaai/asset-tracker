import { describe, expect, it } from 'vitest';
import { ar } from '../i18n/ar';
import { en } from '../i18n/en';
import { alertCurrency, alertMessage, alertTargets, alertValue, evaluateAlerts, noticeText, REARM_MARGIN, suggestAlertValue } from './alerts';
import { alert, market } from './test-fixtures';

const totals = { usd: 2016.34, syp: 308_000 };

describe('alertValue', () => {
  const m = market();
  it('reads every kind of target', () => {
    expect(alertValue('metal:XAU', m, totals)).toBe(3575.1);
    expect(alertValue('metal:XAG', m, totals)).toBe(41.37);
    expect(alertValue('sygold:21K', m, totals)).toBe(15550);
    expect(alertValue('syp:USD', m, totals)).toBe(152.5);
    expect(alertValue('syp:EUR', m, totals)).toBe(165.9);
    expect(alertValue('crypto:bitcoin', m, totals)).toBe(60889);
    expect(alertValue('stock:spy', m, totals)).toBe(716.7);
    expect(alertValue('total:USD', m, totals)).toBe(2016.34);
    expect(alertValue('total:SYP', m, totals)).toBe(308_000);
  });

  it('returns null for unknown or missing data', () => {
    expect(alertValue('crypto:dogecoin', m, totals)).toBeNull();
    expect(alertValue('sygold:14K', m, totals)).toBeNull();
    expect(alertValue('nonsense', m, totals)).toBeNull();
    expect(alertValue('total:USD', m, { usd: null, syp: null })).toBeNull();
  });

  it('watches the market dollar rate even when the user set a manual rate', () => {
    const manual = market({ sypBuy: 140, sypSell: 141, sypSource: 'manual' });
    expect(alertValue('syp:USD', manual, totals)).toBe(152.5);
  });

  it('knows the currency of each target', () => {
    expect(alertCurrency('metal:XAU', m)).toBe('USD');
    expect(alertCurrency('sygold:21K', m)).toBe('SYP');
    expect(alertCurrency('syp:USD', m)).toBe('SYP');
    expect(alertCurrency('total:SYP', m)).toBe('SYP');
    expect(alertCurrency('stock:VUSA.L', market({ stocks: { 'VUSA.L': { price: 90, currency: 'GBP' } } }))).toBe('GBP');
  });
});

describe('evaluateAlerts', () => {
  const NOW = '2026-11-26T12:00:00.000Z';

  it('fires "above" when the price reaches the line, and a one-time alert switches itself off', () => {
    const a = alert({ condition: 'above', value: 3500 });
    const r = evaluateAlerts([a], () => 3575, NOW);
    expect(r.fired).toHaveLength(1);
    expect(r.fired[0].value).toBe(3575);
    expect(r.changed[0]).toMatchObject({ state: 'fired', active: false, lastTriggeredAt: NOW, lastValue: 3575 });
  });

  it('fires exactly at the line', () => {
    expect(evaluateAlerts([alert({ condition: 'below', value: 150 })], () => 150).fired).toHaveLength(1);
    expect(evaluateAlerts([alert({ condition: 'above', value: 150 })], () => 150).fired).toHaveLength(1);
  });

  it('does nothing while the condition is not met', () => {
    const r = evaluateAlerts([alert({ condition: 'below', value: 3000 })], () => 3575);
    expect(r).toEqual({ fired: [], changed: [] });
  });

  it('skips paused alerts and targets without a price', () => {
    expect(evaluateAlerts([alert({ active: false, value: 1 })], () => 3575).fired).toHaveLength(0);
    expect(evaluateAlerts([alert({ value: 1 })], () => null).fired).toHaveLength(0);
    expect(evaluateAlerts([alert({ value: 1 })], () => Number.NaN).fired).toHaveLength(0);
  });

  it('a repeating alert fires once, waits, and re-arms only after the price moves clearly back', () => {
    let a = alert({ condition: 'above', value: 100, repeat: true });
    let r = evaluateAlerts([a], () => 101);
    expect(r.fired).toHaveLength(1);
    a = r.changed[0];
    expect(a).toMatchObject({ state: 'fired', active: true });

    // still above: no second notification
    expect(evaluateAlerts([a], () => 102).fired).toHaveLength(0);
    // dips just under the line (inside the margin): stays fired, no spam
    r = evaluateAlerts([a], () => 100 * (1 - REARM_MARGIN / 2));
    expect(r.changed).toHaveLength(0);
    // clearly back under: re-armed
    r = evaluateAlerts([a], () => 99);
    expect(r.changed[0]).toMatchObject({ state: 'armed' });
    a = r.changed[0];
    // crosses again: fires again
    expect(evaluateAlerts([a], () => 100.5).fired).toHaveLength(1);
  });

  it('re-arms "below" alerts when the price moves clearly back up', () => {
    const a = alert({ condition: 'below', value: 150, repeat: true, state: 'fired' });
    expect(evaluateAlerts([a], () => 150.2).changed).toHaveLength(0);
    expect(evaluateAlerts([a], () => 152).changed[0]).toMatchObject({ state: 'armed' });
  });
});

describe('suggestAlertValue', () => {
  it('starts 2% away from today, so a new alert never fires the moment it is saved', () => {
    expect(suggestAlertValue(15550, 'above')).toBe(15850);
    expect(suggestAlertValue(15550, 'below')).toBe(15250);
    expect(suggestAlertValue(152.5, 'above')).toBe(155.5);
    expect(suggestAlertValue(3575.1, 'above')).toBe(3650);
    expect(suggestAlertValue(60889, 'below')).toBe(59650);
    expect(suggestAlertValue(0.9991, 'above')).toBe(1.02);
    expect(suggestAlertValue(0.5, 'below')).toBe(0.49);
    for (const v of [0.5, 7, 152.5, 3575, 15550, 60889]) {
      expect(suggestAlertValue(v, 'above')!).toBeGreaterThan(v);
      expect(suggestAlertValue(v, 'below')!).toBeLessThan(v);
    }
    expect(suggestAlertValue(null, 'above')).toBeNull();
  });
});

describe('alert messages and targets', () => {
  const m = market();

  it('writes a clear message in English and Arabic', () => {
    const a = alert({ target: 'syp:USD', condition: 'above', value: 150, note: 'Sell dollars' });
    expect(alertMessage(a, 152.5, m, en, 'en')).toEqual({
      title: 'USD in Syrian pounds (buy) is above 150.00',
      body: 'Now 152.50 · Sell dollars',
    });
    const msg = alertMessage(alert({ target: 'metal:XAU', condition: 'below', value: 3600 }), 3575.1, m, ar, 'ar');
    expect(msg.title).toContain('الذهب');
    expect(msg.title).toContain('أقل من');
    expect(msg.body).toContain('3,575.10');
  });

  it('lists gold, the dollar, held coins and stocks, and the total', () => {
    const targets = alertTargets(m, { crypto: ['solana'], stocks: ['voo'] }, en).map((o) => o.target);
    expect(targets).toEqual(
      expect.arrayContaining(['metal:XAU', 'metal:XAG', 'sygold:21K', 'sygold:24K', 'syp:USD', 'syp:EUR', 'crypto:bitcoin', 'crypto:solana', 'stock:SPY', 'stock:VOO', 'total:USD', 'total:SYP']),
    );
    expect(targets).not.toContain('sygold:22K'); // no market price for 22K in this fixture
    expect(new Set(targets).size).toBe(targets.length);
  });
});

describe('saved notification text', () => {
  const m = market();
  const priceData = { type: 'price' as const, target: 'metal:XAU', condition: 'above' as const, line: 3700, value: 3712.5, note: 'sell some' };

  it('is shown in the language the app uses now, not the one it was sent in', () => {
    const n = { title: 'old English title', body: 'old', data: priceData };
    const inEn = noticeText(n, m, en, 'en');
    const inAr = noticeText(n, m, ar, 'ar');
    expect(inEn.title).toBe('Gold (world price, per ounce) is above $3,700.00');
    expect(inEn.body).toBe('Now $3,712.50 · sell some');
    expect(inAr.title).toContain('الذهب');
    expect(inAr.title).not.toBe(inEn.title);
  });

  it('shows budget warnings from their numbers', () => {
    const n = { title: 'x', body: 'y', data: { type: 'budget' as const, level: 100 as const, spent: 70, limit: 60, currency: 'USD' as const } };
    expect(noticeText(n, m, en, 'en')).toEqual({ title: 'You are over your monthly budget', body: 'Spent $70.00 of $60.00 this month.' });
  });

  it('falls back to the saved text when there are no facts', () => {
    expect(noticeText({ title: 'Saved', body: 'text', data: null }, m, en, 'en')).toEqual({ title: 'Saved', body: 'text' });
  });
});
