import { describe, expect, it } from 'vitest';
import { parseSpToday, readJsonAt } from './sptoday';

/** Builds a page shaped like sp-today's: data inside Next.js flight chunks, split mid-JSON. */
function fakePage(usdBuy: number, usdSell: number): string {
  const payload =
    '1:["$","div",null,{}]\n' +
    '2:{"cities":[{"slug":"damascus","name_en":"Syria - General","name_ar":"سوريا - عام"},{"slug":"alhasakah","name_en":"Al-Hasakah","name_ar":"الحسكة"}],' +
    `"rates":[{"code":"USD","slug":"us-dollar","name":"US Dollar","name_ar":"دولار أمريكي","symbol":"USD","flag":"🇺🇸","cities":{"damascus":{"buy":${usdBuy},"sell":${usdSell},"change":0},"alhasakah":{"buy":15150,"sell":15225,"change":0}},"updated_at":"2026-11-26T00:11:47+03:00"},` +
    '{"code":"EUR","cities":{"damascus":{"buy":16560,"sell":16750,"change":0.1}},"updated_at":"2026-11-26T00:11:47+03:00"}],' +
    '"gold":{"karats":[{"karat":"24K","cities":{"damascus":{"buy":1795000,"sell":1825000,"change":2.57}},"updated_at":"2026-11-26T10:16:03+03:00"},' +
    '{"karat":"21K","cities":{"damascus":{"buy":1555000,"sell":1585000,"change":2.3}},"updated_at":"2026-11-26T11:34:02+03:00"}],"ounce":{"price_usd":3561}}}';
  const cut = Math.floor(payload.length / 2);
  const chunk = (s: string) => `<script>self.__next_f.push([1,${JSON.stringify(s)}])</script>`;
  return `<!doctype html><html><body><div>152.25</div>${chunk(payload.slice(0, cut))}${chunk(payload.slice(cut))}</body></html>`;
}

describe('sp-today parser', () => {
  it('reads old-pound numbers and converts them to new pounds', () => {
    const r = parseSpToday(fakePage(15225, 15275));
    expect(r.divisor).toBe(100);
    const usd = r.quotes.find((q) => q.key === 'syp:USD')!;
    expect(usd.bid).toBeCloseTo(152.25, 6);
    expect(usd.ask).toBeCloseTo(152.75, 6);
    expect(usd.asOf).toBe('2026-11-26T00:11:47+03:00');
    expect(r.quotes.find((q) => q.key === 'syp:EUR')!.bid).toBeCloseTo(165.6, 6);
    expect(r.quotes.find((q) => q.key === 'sygold:21K')!.bid).toBeCloseTo(15_550, 6);
  });

  it('keeps numbers that are already in new pounds', () => {
    const r = parseSpToday(fakePage(152.25, 152.75));
    expect(r.divisor).toBe(1);
    expect(r.quotes.find((q) => q.key === 'syp:USD')!.bid).toBeCloseTo(152.25, 6);
  });

  it('uses the chosen city, and falls back to the general rate', () => {
    expect(parseSpToday(fakePage(15225, 15275), 'alhasakah').quotes.find((q) => q.key === 'syp:USD')!.bid).toBeCloseTo(151.5, 6);
    expect(parseSpToday(fakePage(15225, 15275), 'nowhere').city).toBe('damascus');
  });

  it('lists the cities with their names', () => {
    const r = parseSpToday(fakePage(15225, 15275));
    expect(r.cities).toEqual([
      { slug: 'damascus', en: 'Syria - General', ar: 'سوريا - عام' },
      { slug: 'alhasakah', en: 'Al-Hasakah', ar: 'الحسكة' },
    ]);
  });

  it('fails clearly when the page has no rates', () => {
    expect(() => parseSpToday('<html>maintenance</html>')).toThrow(/rates not found/);
  });

  it('reads JSON that contains brackets inside strings', () => {
    const text = 'x:[{"a":"[not] {real}","b":[1,2]}] tail';
    expect(readJsonAt(text, 2)).toEqual([{ a: '[not] {real}', b: [1, 2] }]);
  });
});
