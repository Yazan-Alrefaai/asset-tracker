import { ASSET_TYPES, type Asset, type AssetType, type Tx } from '../model';
import type { Market } from './market';
import { type UnitValue, unitValue } from './valuation';

const EPS = 1e-9;

export interface Holding {
  asset: Asset;
  quantity: number;
  /** Cost of what you still hold (average-cost method), in USD and in SYP. */
  costUsd: number;
  costSyp: number | null;
  /** Profit already taken by selling. */
  realizedUsd: number;
  realizedSyp: number | null;
  unit: UnitValue;
  valueUsd: number | null;
  valueSyp: number | null;
  pnlUsd: number | null;
  pnlSyp: number | null;
  pnlPct: number | null;
  pnlPctSyp: number | null;
  avgCostUsd: number | null;
  avgCostSyp: number | null;
  /** A sell was larger than the amount held at that time. */
  oversold: boolean;
  txCount: number;
}

const addN = (a: number | null, b: number | null): number | null => (a == null || b == null ? null : a + b);

/** Amount of a transaction expressed in SYP (new), or null when the SYP rate of that day is unknown. */
function sypAmount(amountInCurrency: number, t: Tx): number | null {
  if (t.currency === 'SYP') return amountInCurrency;
  if (t.sypRate == null || !(t.sypRate > 0)) return null;
  return (amountInCurrency / (t.usdRate > 0 ? t.usdRate : 1)) * t.sypRate;
}

export function sortTxs(txs: Tx[]): Tx[] {
  return [...txs].sort((a, b) => (a.date === b.date ? a.id - b.id : a.date < b.date ? -1 : 1));
}

export function computeHolding(asset: Asset, txs: Tx[], m: Market): Holding {
  const list = sortTxs(txs.filter((t) => t.assetId === asset.id));
  let qty = 0;
  let costUsd = 0;
  let costSyp: number | null = 0;
  let realizedUsd = 0;
  let realizedSyp: number | null = 0;
  let oversold = false;

  for (const t of list) {
    const usdRate = t.usdRate > 0 ? t.usdRate : 1;
    const gross = t.quantity * t.price;
    if (t.kind === 'buy') {
      const total = gross + t.fees;
      costUsd += total / usdRate;
      costSyp = addN(costSyp, sypAmount(total, t));
      qty += t.quantity;
    } else {
      const proceeds = gross - t.fees;
      if (t.quantity > qty + EPS) oversold = true;
      const frac = qty > EPS ? Math.min(1, t.quantity / qty) : 0;
      const partUsd: number = costUsd * frac;
      const partSyp: number | null = costSyp == null ? null : costSyp * frac;
      realizedUsd += proceeds / usdRate - partUsd;
      const proceedsSyp = sypAmount(proceeds, t);
      realizedSyp = realizedSyp == null || proceedsSyp == null || partSyp == null ? null : realizedSyp + proceedsSyp - partSyp;
      costUsd -= partUsd;
      costSyp = costSyp == null || partSyp == null ? null : costSyp - partSyp;
      qty -= t.quantity;
    }
  }

  if (qty < EPS) {
    qty = Math.max(0, qty);
    if (qty < EPS) {
      qty = 0;
      costUsd = 0;
      if (costSyp != null) costSyp = 0;
    }
  }

  const unit = unitValue(asset, m);
  const hasQty = qty > EPS;
  const valueUsd = unit.usd == null ? null : qty * unit.usd;
  const valueSyp = unit.syp == null ? null : qty * unit.syp;
  const pnlUsd = hasQty && valueUsd != null ? valueUsd - costUsd : null;
  const pnlSyp = hasQty && valueSyp != null && costSyp != null ? valueSyp - costSyp : null;

  return {
    asset,
    quantity: qty,
    costUsd,
    costSyp,
    realizedUsd,
    realizedSyp,
    unit,
    valueUsd,
    valueSyp,
    pnlUsd,
    pnlSyp,
    pnlPct: pnlUsd != null && costUsd > EPS ? pnlUsd / costUsd : null,
    pnlPctSyp: pnlSyp != null && costSyp != null && costSyp > EPS ? pnlSyp / costSyp : null,
    avgCostUsd: hasQty ? costUsd / qty : null,
    avgCostSyp: hasQty && costSyp != null ? costSyp / qty : null,
    oversold,
    txCount: list.length,
  };
}

export interface TypeSlice {
  type: AssetType;
  valueUsd: number;
  share: number;
}

export interface Summary {
  valueUsd: number;
  valueSyp: number | null;
  costUsd: number;
  costSyp: number | null;
  /** Unrealized profit/loss of the priced holdings. */
  pnlUsd: number;
  pnlSyp: number | null;
  pnlPct: number | null;
  pnlPctSyp: number | null;
  realizedUsd: number;
  realizedSyp: number | null;
  /** Holdings with an amount but no price yet. */
  missing: number;
  openCount: number;
  slices: TypeSlice[];
}

export function summarize(holdings: Holding[]): Summary {
  let valueUsd = 0;
  let valueSyp: number | null = 0;
  let costUsd = 0;
  let costSyp: number | null = 0;
  let pnlUsd = 0;
  let pnlSyp: number | null = 0;
  let pricedCostUsd = 0;
  let pricedCostSyp: number | null = 0;
  let realizedUsd = 0;
  let realizedSyp: number | null = 0;
  let missing = 0;
  let openCount = 0;
  const byType = new Map<AssetType, number>();

  for (const h of holdings) {
    realizedUsd += h.realizedUsd;
    realizedSyp = addN(realizedSyp, h.realizedSyp);
    if (h.quantity <= EPS) continue;
    openCount++;
    costUsd += h.costUsd;
    costSyp = addN(costSyp, h.costSyp);
    if (h.valueUsd == null) {
      missing++;
      continue;
    }
    valueUsd += h.valueUsd;
    valueSyp = addN(valueSyp, h.valueSyp);
    pnlUsd += h.valueUsd - h.costUsd;
    pnlSyp = addN(pnlSyp, h.pnlSyp);
    pricedCostUsd += h.costUsd;
    pricedCostSyp = addN(pricedCostSyp, h.costSyp);
    byType.set(h.asset.type, (byType.get(h.asset.type) ?? 0) + h.valueUsd);
  }

  const slices = ASSET_TYPES.filter((t) => (byType.get(t) ?? 0) > 0).map((type) => ({
    type,
    valueUsd: byType.get(type) ?? 0,
    share: valueUsd > 0 ? (byType.get(type) ?? 0) / valueUsd : 0,
  }));

  return {
    valueUsd,
    valueSyp,
    costUsd,
    costSyp,
    pnlUsd,
    pnlSyp,
    pnlPct: pricedCostUsd > EPS ? pnlUsd / pricedCostUsd : null,
    pnlPctSyp: pnlSyp != null && pricedCostSyp != null && pricedCostSyp > EPS ? pnlSyp / pricedCostSyp : null,
    realizedUsd,
    realizedSyp,
    missing,
    openCount,
    slices,
  };
}
