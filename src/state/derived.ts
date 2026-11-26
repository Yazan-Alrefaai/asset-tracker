import { useMemo } from 'react';
import type { Messages } from '../i18n/en';
import type { Totals } from '../lib/alerts';
import { buildMarket, type Market } from '../lib/calc/market';
import { computeHolding, summarize, type Holding } from '../lib/calc/portfolio';
import type { Portfolio, Tx } from '../lib/model';
import { type AppState, useStore } from './store';

/** All holdings (not a hook: for engines that run outside React). */
export function holdingsOf(st: Pick<AppState, 'assets' | 'txs'>, m: Market): Holding[] {
  const byAsset = groupTxs(st.txs);
  return st.assets.filter((a) => !a.archived).map((a) => computeHolding(a, byAsset.get(a.id) ?? [], m));
}

/** Total value of everything, or nulls while any price is still missing (so alerts never fire on half a total). */
export function totalsOf(st: Pick<AppState, 'assets' | 'txs'>, m: Market): Totals {
  const s = summarize(holdingsOf(st, m));
  return s.openCount === 0 || s.missing > 0 ? { usd: null, syp: null } : { usd: s.valueUsd, syp: s.valueSyp };
}

export function useMarket(): Market {
  const quotes = useStore((s) => s.quotes);
  const settings = useStore((s) => s.settings);
  return useMemo(() => buildMarket(quotes, settings), [quotes, settings]);
}

export function groupTxs(txs: Tx[]): Map<number, Tx[]> {
  const map = new Map<number, Tx[]>();
  for (const t of txs) {
    const list = map.get(t.assetId);
    if (list) list.push(t);
    else map.set(t.assetId, [t]);
  }
  return map;
}

export function useHoldings(portfolioId: number | 'all'): Holding[] {
  const assets = useStore((s) => s.assets);
  const txs = useStore((s) => s.txs);
  const m = useMarket();
  return useMemo(() => {
    const byAsset = groupTxs(txs);
    return assets
      .filter((a) => !a.archived && (portfolioId === 'all' || a.portfolioId === portfolioId))
      .map((a) => computeHolding(a, byAsset.get(a.id) ?? [], m));
  }, [assets, txs, m, portfolioId]);
}

export function portfolioName(p: Portfolio | undefined, t: Messages): string {
  if (!p) return '';
  return p.name.trim() || t.defaultPortfolioNames[p.kind];
}
