import { describe, expect, it } from 'vitest';
import { parseHash } from './router';
import { parseWidgetConfig, widgetHash, widgetLabel } from './widgets';

describe('widget windows', () => {
  it('gives each widget a stable window label and address', () => {
    expect(widgetLabel('prices')).toBe('widget-prices');
    expect(widgetLabel('total', 0)).toBe('widget-total-0');
    expect(widgetLabel('asset', 12)).toBe('widget-asset-12');
    expect(widgetHash('asset', 12)).toBe('#/widget/asset/12');
    expect(widgetHash('prices')).toBe('#/widget/prices');
  });

  it('routes widget addresses, and rejects broken ones', () => {
    expect(parseHash(widgetHash('total', 2))).toEqual({ name: 'widget', kind: 'total', ref: 2 });
    expect(parseHash(widgetHash('prices'))).toEqual({ name: 'widget', kind: 'prices', ref: 0 });
    expect(parseHash('#/widget/asset/12')).toEqual({ name: 'widget', kind: 'asset', ref: 12 });
    expect(parseHash('#/widget/evil/1')).toEqual({ name: 'dashboard' });
    expect(parseHash('#/widget/asset/-3')).toEqual({ name: 'dashboard' });
    expect(parseHash('#/alerts')).toEqual({ name: 'alerts' });
    expect(parseHash('#/zakat')).toEqual({ name: 'zakat' });
  });

  it('reads saved widget settings safely', () => {
    expect(parseWidgetConfig(JSON.stringify({ label: 'widget-total-0', kind: 'total', ref: 0, x: 10, y: 20, w: 300, h: 170 }))).toEqual({
      label: 'widget-total-0',
      kind: 'total',
      ref: 0,
      open: true,
      onTop: true,
      x: 10,
      y: 20,
      w: 300,
      h: 170,
    });
    expect(parseWidgetConfig(JSON.stringify({ label: 'widget-prices', kind: 'prices', open: false, onTop: false, x: 'oops' }))).toMatchObject({
      open: false,
      onTop: false,
      x: undefined,
    });
    expect(parseWidgetConfig('not json')).toBeNull();
    expect(parseWidgetConfig(JSON.stringify({ label: 'main', kind: 'total' }))).toBeNull();
    expect(parseWidgetConfig(JSON.stringify({ label: 'widget-x', kind: 'other' }))).toBeNull();
  });
});
