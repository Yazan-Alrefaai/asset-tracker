import { describe, expect, it } from 'vitest';
import { parseHash } from './router';

describe('router', () => {
  it('opens the income & expenses page', () => {
    expect(parseHash('#/cashflow')).toEqual({ name: 'cashflow' });
    expect(parseHash('#cashflow')).toEqual({ name: 'cashflow' });
  });

  it('keeps the existing pages working', () => {
    expect(parseHash('')).toEqual({ name: 'dashboard' });
    expect(parseHash('#/asset/3/buy')).toEqual({ name: 'asset', id: 3, action: 'buy' });
    expect(parseHash('#/asset/x')).toEqual({ name: 'dashboard' });
    expect(parseHash('#/zakat')).toEqual({ name: 'zakat' });
    expect(parseHash('#/widget/total/0')).toEqual({ name: 'widget', kind: 'total', ref: 0 });
    expect(parseHash('#/nope')).toEqual({ name: 'dashboard' });
  });
});
