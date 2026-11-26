/**
 * Price engine: refreshes each group of prices on its own schedule, falls back to a second
 * source when the first fails, and keeps the last good prices (in the database) for offline use.
 */
import { CURRENCIES, coinById } from '../lib/catalog';
import { getDb } from '../lib/db';
import { upsertQuotes } from '../lib/db/repo';
import type { Quote } from '../lib/model';
import {
  fetchBinance,
  fetchCoinGecko,
  fetchErApi,
  fetchFrankfurter,
  fetchGoldApi,
  fetchSwissquote,
  fetchYahoo,
  makeQuote,
} from '../lib/prices/sources';
import { fetchSpToday } from '../lib/prices/sptoday';
import { errorText, PRICE_GROUPS, type GroupStatus, type PriceGroup, useStore } from './store';

const RETRY_SECONDS = 90;

function intervalSeconds(g: PriceGroup, refreshSeconds: number): number {
  if (g === 'fx') return 6 * 3600;
  if (g === 'syp') return 15 * 60; // be gentle with sp-today
  return Math.max(30, refreshSeconds);
}

let timer: ReturnType<typeof setInterval> | undefined;
let afterUpdate: (() => void) | undefined;

function setStatus(g: PriceGroup, patch: Partial<GroupStatus>): void {
  useStore.setState((s) => ({ status: { ...s.status, [g]: { ...s.status[g], ...patch } } }));
}

/** Slow-changing groups (FX, SYP) are not refetched on every app start if the saved prices are recent. */
function primeFromCache(): void {
  const { quotes } = useStore.getState();
  for (const [g, prefix] of [
    ['fx', 'fx:'],
    ['syp', 'syp:'],
  ] as const) {
    const newest = Math.max(
      0,
      ...Object.values(quotes)
        .filter((q) => q.key.startsWith(prefix))
        .map((q) => Date.parse(q.fetchedAt) || 0),
    );
    if (newest > 0) setStatus(g, { lastAttempt: newest, lastOk: new Date(newest).toISOString() });
  }
}

export function startPriceEngine(onUpdate: () => void): void {
  afterUpdate = onUpdate;
  if (timer) return;
  primeFromCache();
  void tick(false);
  timer = setInterval(() => void tick(false), 10_000);
  window.addEventListener('online', () => void tick(true));
}

/** Refresh now (all groups, or only the given ones). */
export function refreshPrices(only?: PriceGroup[]): void {
  void tick(true, only);
}

async function tick(force: boolean, only?: PriceGroup[]): Promise<void> {
  const st = useStore.getState();
  const now = Date.now();
  for (const g of only ?? PRICE_GROUPS) {
    const s = st.status[g];
    if (s.running) continue;
    const base = intervalSeconds(g, st.settings.refreshSeconds);
    const wait = (s.lastError ? Math.min(base, RETRY_SECONDS) : base) * 1000;
    if (force || now - s.lastAttempt >= wait) void runGroup(g);
  }
}

async function runGroup(g: PriceGroup): Promise<void> {
  setStatus(g, { running: true, lastAttempt: Date.now() });
  try {
    const quotes = await fetchGroup(g);
    if (!quotes.length) throw new Error('no prices returned');
    await saveQuotes(quotes);
    setStatus(g, { running: false, lastOk: new Date().toISOString(), lastError: null });
    if (g !== 'fx') afterUpdate?.();
  } catch (e) {
    setStatus(g, { running: false, lastError: errorText(e) });
  }
}

async function saveQuotes(quotes: Quote[]): Promise<void> {
  useStore.setState((s) => ({ quotes: { ...s.quotes, ...Object.fromEntries(quotes.map((q) => [q.key, q])) } }));
  await upsertQuotes(await getDb(), quotes);
}

async function firstOk<T>(...attempts: (() => Promise<T>)[]): Promise<T> {
  let last: unknown = new Error('no source');
  for (const attempt of attempts) {
    try {
      return await attempt();
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

function settledValues<T>(results: PromiseSettledResult<T>[]): T[] {
  const ok = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  if (!ok.length) {
    const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    throw failed ? failed.reason : new Error('no prices');
  }
  return ok;
}

const unique = (xs: string[]) => [...new Set(xs.filter(Boolean))];

async function fetchGroup(g: PriceGroup): Promise<Quote[]> {
  const st = useStore.getState();
  const assets = st.assets.filter((a) => !a.archived);
  switch (g) {
    case 'metals': {
      const results = await Promise.allSettled(
        (['XAU', 'XAG'] as const).map((s) => firstOk(() => fetchGoldApi(s), () => fetchSwissquote(s))),
      );
      return settledValues(results);
    }
    case 'syp': {
      const r = await fetchSpToday(st.settings.sypCity);
      useStore.setState({ spCities: r.cities });
      return r.quotes;
    }
    case 'crypto': {
      const ids = unique(['bitcoin', ...assets.filter((a) => a.type === 'crypto').map((a) => a.symbol)]);
      let quotes: Quote[] = [];
      try {
        quotes = await fetchCoinGecko(ids);
      } catch {
        /* try the backup below */
      }
      const has = (id: string) => quotes.some((q) => q.key === `crypto:${id}`);
      const missing = ids.filter((id) => !has(id));
      if (missing.length) {
        const pairs: Record<string, string> = {};
        for (const id of missing) {
          const coin = coinById(id);
          if (coin?.binance) pairs[coin.binance] = id;
        }
        try {
          quotes = quotes.concat(await fetchBinance(pairs));
        } catch {
          /* keep what we have */
        }
        for (const id of missing) {
          if (coinById(id)?.stable && !has(id)) quotes.push(makeQuote(`crypto:${id}`, 1, 'USD', 'stablecoin (1 USD)'));
        }
      }
      return quotes;
    }
    case 'stocks': {
      const tickers = unique(['SPY', ...assets.filter((a) => a.type === 'stock').map((a) => a.symbol.toUpperCase())]);
      return settledValues(await Promise.allSettled(tickers.map((t) => fetchYahoo(t))));
    }
    case 'fx': {
      const codes = CURRENCIES.map((c) => c.code).filter((c) => c !== 'USD');
      return firstOk(
        () => fetchErApi(codes),
        () => fetchFrankfurter(codes),
      );
    }
  }
}
