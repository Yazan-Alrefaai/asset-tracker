/**
 * Free price sources (no API key, no credit card). Each source has a pure `parse…` function
 * (unit-tested) and a `fetch…` function that downloads and parses.
 */
import { httpJson } from '../http';
import type { Quote } from '../model';

type Json = Record<string, unknown>;

export const toNum = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
};

const isoFromUnix = (s: unknown): string | null => {
  const n = typeof s === 'number' ? s : Number(s);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000).toISOString() : null;
};

export function makeQuote(key: string, price: number, currency: string, source: string, more: Partial<Quote> = {}): Quote {
  return {
    key,
    price,
    currency,
    source,
    bid: null,
    ask: null,
    asOf: null,
    fetchedAt: new Date().toISOString(),
    extra: null,
    ...more,
  };
}

export type MetalSymbol = 'XAU' | 'XAG';

// ---------------- gold-api.com (real-time metals) ----------------

export function parseGoldApi(json: unknown, symbol: MetalSymbol): Quote {
  const j = (json ?? {}) as Json;
  const price = toNum(j.price);
  if (price == null) throw new Error('gold-api: missing price');
  return makeQuote(`metal:${symbol}`, price, 'USD', 'gold-api.com', {
    asOf: typeof j.updatedAt === 'string' ? j.updatedAt : null,
  });
}

export async function fetchGoldApi(symbol: MetalSymbol): Promise<Quote> {
  return parseGoldApi(await httpJson(`https://api.gold-api.com/price/${symbol}`), symbol);
}

// ---------------- Swissquote public feed (metals backup) ----------------

export function parseSwissquote(json: unknown, symbol: MetalSymbol): Quote {
  const list = Array.isArray(json) ? (json as Json[]) : [];
  for (const item of list) {
    const profiles = Array.isArray(item?.spreadProfilePrices) ? (item.spreadProfilePrices as Json[]) : [];
    const p = profiles.find((x) => x?.spreadProfile === 'prime') ?? profiles[0];
    const bid = toNum(p?.bid);
    const ask = toNum(p?.ask);
    if (bid != null && ask != null) {
      return makeQuote(`metal:${symbol}`, (bid + ask) / 2, 'USD', 'swissquote.com', {
        bid,
        ask,
        asOf: typeof item.ts === 'number' ? new Date(item.ts).toISOString() : null,
      });
    }
  }
  throw new Error('swissquote: no prices');
}

export async function fetchSwissquote(symbol: MetalSymbol): Promise<Quote> {
  const url = `https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/${symbol}/USD`;
  return parseSwissquote(await httpJson(url), symbol);
}

// ---------------- CoinGecko (crypto) ----------------

export function parseCoinGecko(json: unknown, ids: string[]): Quote[] {
  const j = (json ?? {}) as Record<string, Json>;
  const out: Quote[] = [];
  for (const id of ids) {
    const row = j[id];
    const price = toNum(row?.usd);
    if (price == null) continue;
    const change = typeof row.usd_24h_change === 'number' ? row.usd_24h_change : null;
    out.push(
      makeQuote(`crypto:${id}`, price, 'USD', 'coingecko.com', {
        asOf: isoFromUnix(row.last_updated_at),
        extra: change == null ? null : { change24h: change },
      }),
    );
  }
  return out;
}

export async function fetchCoinGecko(ids: string[]): Promise<Quote[]> {
  if (!ids.length) return [];
  const url =
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.map(encodeURIComponent).join(',')}` +
    `&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`;
  return parseCoinGecko(await httpJson(url), ids);
}

// ---------------- Binance (crypto backup) ----------------

/** @param pairToId map of Binance pair (e.g. BTCUSDT) → CoinGecko id */
export function parseBinance(json: unknown, pairToId: Record<string, string>): Quote[] {
  const list = Array.isArray(json) ? (json as Json[]) : [json as Json];
  const out: Quote[] = [];
  for (const row of list) {
    const id = pairToId[String(row?.symbol ?? '')];
    const price = toNum(row?.price);
    if (id && price != null) out.push(makeQuote(`crypto:${id}`, price, 'USD', 'binance.com'));
  }
  return out;
}

export async function fetchBinance(pairToId: Record<string, string>): Promise<Quote[]> {
  const pairs = Object.keys(pairToId);
  if (!pairs.length) return [];
  const url = `https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(JSON.stringify(pairs))}`;
  return parseBinance(await httpJson(url), pairToId);
}

// ---------------- Yahoo Finance (stocks, ETFs, indices) ----------------

const MINOR_UNITS: Record<string, [string, number]> = { GBp: ['GBP', 100], GBX: ['GBP', 100], ZAc: ['ZAR', 100], ILA: ['ILS', 100] };

export function parseYahoo(json: unknown, ticker: string): Quote {
  const chart = ((json ?? {}) as Json).chart as Json | undefined;
  const result = Array.isArray(chart?.result) ? (chart.result as Json[]) : [];
  const meta = (result[0]?.meta ?? {}) as Json;
  let price = toNum(meta.regularMarketPrice);
  if (price == null) {
    const err = chart?.error as Json | undefined;
    throw new Error(`yahoo: ${String(err?.description ?? 'no price')}`);
  }
  let currency = String(meta.currency ?? 'USD');
  let prevClose = toNum(meta.chartPreviousClose ?? meta.previousClose);
  const minor = MINOR_UNITS[currency];
  if (minor) {
    currency = minor[0];
    price /= minor[1];
    if (prevClose != null) prevClose /= minor[1];
  }
  return makeQuote(`stock:${ticker.toUpperCase()}`, price, currency, 'finance.yahoo.com', {
    asOf: isoFromUnix(meta.regularMarketTime),
    extra: { name: (meta.longName ?? meta.shortName ?? null) as string | null, prevClose },
  });
}

export async function fetchYahoo(ticker: string): Promise<Quote> {
  const path = `/v8/finance/chart/${encodeURIComponent(ticker.toUpperCase())}?range=1d&interval=1d`;
  try {
    return parseYahoo(await httpJson(`https://query1.finance.yahoo.com${path}`), ticker);
  } catch {
    return parseYahoo(await httpJson(`https://query2.finance.yahoo.com${path}`), ticker);
  }
}

// ---------------- ExchangeRate-API open access (daily FX) ----------------

export function parseErApi(json: unknown, codes: string[]): Quote[] {
  const j = (json ?? {}) as Json;
  if (j.result !== 'success') throw new Error('exchangerate-api: request failed');
  const rates = (j.rates ?? {}) as Record<string, unknown>;
  const asOf = isoFromUnix(j.time_last_update_unix);
  const out: Quote[] = [];
  for (const code of codes) {
    const r = toNum(rates[code]);
    if (r != null) out.push(makeQuote(`fx:${code}`, r, code, 'exchangerate-api.com', { asOf }));
  }
  return out;
}

export async function fetchErApi(codes: string[]): Promise<Quote[]> {
  return parseErApi(await httpJson('https://open.er-api.com/v6/latest/USD'), codes);
}

// ---------------- Frankfurter / ECB (FX backup + history) ----------------

export function parseFrankfurter(json: unknown, codes: string[]): Quote[] {
  const j = (json ?? {}) as Json;
  const rates = (j.rates ?? {}) as Record<string, unknown>;
  const asOf = typeof j.date === 'string' ? `${j.date}T00:00:00Z` : null;
  const out: Quote[] = [];
  for (const code of codes) {
    const r = toNum(rates[code]);
    if (r != null) out.push(makeQuote(`fx:${code}`, r, code, 'frankfurter.dev', { asOf }));
  }
  if (!out.length) throw new Error('frankfurter: no rates');
  return out;
}

export async function fetchFrankfurter(codes: string[]): Promise<Quote[]> {
  return parseFrankfurter(await httpJson('https://api.frankfurter.dev/v1/latest?base=USD'), codes);
}

/** Units of `code` per 1 USD on a past date (major currencies only). */
export async function fetchHistoricalUsdRate(date: string, code: string): Promise<number | null> {
  const j = await httpJson<Json>(`https://api.frankfurter.dev/v1/${date}?base=USD&symbols=${code}`);
  return toNum(((j.rates ?? {}) as Record<string, unknown>)[code]);
}
