import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, parseSettings } from './settings';

const row = (key: string, value: unknown) => ({ key, value: JSON.stringify(value) });

describe('parseSettings', () => {
  it('uses defaults for anything not saved', () => {
    const s = parseSettings([]);
    expect(s.trayItems).toEqual(DEFAULT_SETTINGS.trayItems);
    expect(s.keepInTray).toBe(true);
    expect(s.zakatBasis).toBe('gold');
    expect(s.zakatOverrides).toEqual({});
  });

  it('reads saved values of the right shape', () => {
    const s = parseSettings([
      row('language', 'ar'),
      row('trayItems', ['btc', 'total']),
      row('zakatPortfolios', [1]),
      row('zakatOverrides', { '5': false }),
      row('sypManualBuy', 150),
      row('keepInTray', false),
    ]);
    expect(s).toMatchObject({ language: 'ar', trayItems: ['btc', 'total'], zakatPortfolios: [1], zakatOverrides: { '5': false }, sypManualBuy: 150, keepInTray: false });
  });

  it('ignores broken, wrongly-shaped or unknown values', () => {
    const s = parseSettings([
      { key: 'theme', value: '{broken' },
      row('trayItems', 'btc'),
      row('zakatOverrides', [1, 2]),
      row('keepInTray', 'yes'),
      row('somethingElse', 1),
      row('widget:widget-prices', { label: 'widget-prices' }),
    ]);
    expect(s.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(s.trayItems).toEqual(DEFAULT_SETTINGS.trayItems);
    expect(s.zakatOverrides).toEqual({});
    expect(s.keepInTray).toBe(true);
    expect('somethingElse' in s).toBe(false);
  });

  it('drops menu-bar items it does not know', () => {
    expect(parseSettings([row('trayItems', ['btc', 'dogecoin'])]).trayItems).toEqual(['btc']);
  });
});

describe('budget settings', () => {
  it('defaults to no budget, in USD, for all portfolios, with warnings on', () => {
    const s = parseSettings([]);
    expect(s).toMatchObject({ budgetMonthly: null, budgetCurrency: 'USD', budgetPortfolio: null, budgetAlerts: true, budgetNotified: '' });
  });

  it('reads saved values and drops broken ones', () => {
    const ok = parseSettings([
      { key: 'budgetMonthly', value: '1200' },
      { key: 'budgetCurrency', value: '"SYP"' },
      { key: 'budgetPortfolio', value: '2' },
    ]);
    expect(ok).toMatchObject({ budgetMonthly: 1200, budgetCurrency: 'SYP', budgetPortfolio: 2 });
    const bad = parseSettings([
      { key: 'budgetMonthly', value: '-5' },
      { key: 'budgetCurrency', value: '"EUR"' },
      { key: 'budgetPortfolio', value: '"x"' },
    ]);
    expect(bad).toMatchObject({ budgetMonthly: null, budgetCurrency: 'USD', budgetPortfolio: null });
  });
});
