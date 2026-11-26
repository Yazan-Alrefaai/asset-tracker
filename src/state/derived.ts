import { useMemo } from 'react';
import type { Messages } from '../i18n/en';
import { buildMarket, type Market } from '../lib/calc/market';
import { computeHolding, type Holding } from '../lib/calc/portfolio';
import type { Portfolio, Tx } from '../lib/model';
import { useStore } from './store';

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
