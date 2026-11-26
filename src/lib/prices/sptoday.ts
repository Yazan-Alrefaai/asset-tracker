/**
 * Syrian market rates from sp-today.com (الليرة اليوم).
 *
 * We read only the public page (robots.txt allows it; it disallows /api/, which we never call),
 * at most every 15 minutes, and show the source in the app. The page embeds its data as
 * Next.js "flight" chunks: self.__next_f.push([1,"…json…"]). The numbers there are in OLD
 * Syrian pounds (e.g. 15225), so they are divided by 100 when needed.
 */
import { httpText } from '../http';
import type { Quote } from '../model';
import { makeQuote, toNum } from './sources';

export const SPTODAY_URL = 'https://sp-today.com/en';

export interface SpCity {
  slug: string;
  en: string;
  ar: string;
}

export interface SpTodayResult {
  quotes: Quote[];
  cities: SpCity[];
  city: string;
  divisor: number;
}

interface CityRow {
  buy?: unknown;
  sell?: unknown;
  change?: unknown;
}

interface RateItem {
  code?: string;
  cities?: Record<string, CityRow>;
  updated_at?: string;
}

interface KaratItem {
  karat?: string;
  cities?: Record<string, CityRow>;
  updated_at?: string;
}

/** Joins the text of all Next.js flight chunks in the page. */
export function extractNextPayload(html: string): string {
  const re = /self\.__next_f\.push\(\[1,("(?:[^"\\]|\\[\s\S])*")\]\)/g;
  let out = '';
  for (const m of html.matchAll(re)) {
    try {
      out += JSON.parse(m[1]) as string;
    } catch {
      /* skip broken chunk */
    }
  }
  return out;
}

/** Parses the JSON array/object that starts at index `start` (a '[' or '{'). */
export function readJsonAt(text: string, start: number): unknown {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  throw new Error('unterminated JSON');
}

function findJson(text: string, pattern: RegExp): unknown {
  const m = pattern.exec(text);
  if (!m) return null;
  try {
    return readJsonAt(text, m.index + m[0].length - 1);
  } catch {
    return null;
  }
}

export function parseSpToday(html: string, wantedCity = 'damascus'): SpTodayResult {
  let text = extractNextPayload(html);
  if (!/"rates":\[\{"code":/.test(text)) text = html.replace(/\\"/g, '"');

  const rates = findJson(text, /"rates":\[(?=\{"code":)/) as RateItem[] | null;
  if (!Array.isArray(rates) || !rates.length) throw new Error('sp-today: rates not found');

  const usd = rates.find((r) => r.code === 'USD');
  const citySlugs = Object.keys(usd?.cities ?? {});
  const city = citySlugs.includes(wantedCity) ? wantedCity : citySlugs.includes('damascus') ? 'damascus' : citySlugs[0];
  const usdBuy = toNum(usd?.cities?.[city]?.buy);
  if (!city || usdBuy == null) throw new Error('sp-today: USD rate missing');
  // Old pounds: USD is ~15,000. New pounds: ~150.
  const divisor = usdBuy > 1000 ? 100 : 1;

  const fetchedAt = new Date().toISOString();
  const quotes: Quote[] = [];
  for (const r of rates) {
    const row = r.cities?.[city];
    const buy = toNum(row?.buy);
    const sell = toNum(row?.sell);
    if (!r.code || buy == null || sell == null) continue;
    quotes.push(
      makeQuote(`syp:${r.code}`, buy / divisor, 'SYP', 'sp-today.com', {
        bid: buy / divisor,
        ask: sell / divisor,
        asOf: r.updated_at ?? null,
        fetchedAt,
        extra: { city, change: typeof row?.change === 'number' ? row.change : null },
      }),
    );
  }

  const karats = findJson(text, /"karats":\[(?=\{"karat":)/) as KaratItem[] | null;
  if (Array.isArray(karats)) {
    for (const k of karats) {
      const row = k.cities?.[city];
      const buy = toNum(row?.buy);
      const sell = toNum(row?.sell);
      if (!k.karat || buy == null || sell == null) continue;
      quotes.push(
        makeQuote(`sygold:${k.karat}`, buy / divisor, 'SYP', 'sp-today.com', {
          bid: buy / divisor,
          ask: sell / divisor,
          asOf: k.updated_at ?? null,
          fetchedAt,
          extra: { city, change: typeof row?.change === 'number' ? row.change : null },
        }),
      );
    }
  }

  const named = findJson(text, /"cities":\[(?=\{"slug":)/) as { slug?: string; name_en?: string; name_ar?: string }[] | null;
  const cities: SpCity[] = citySlugs.map((slug) => {
    const n = Array.isArray(named) ? named.find((c) => c.slug === slug) : undefined;
    return { slug, en: n?.name_en ?? slug, ar: n?.name_ar ?? n?.name_en ?? slug };
  });

  return { quotes, cities, city, divisor };
}

export async function fetchSpToday(city: string): Promise<SpTodayResult> {
  return parseSpToday(await httpText(SPTODAY_URL, 20_000), city);
}
