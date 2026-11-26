/**
 * Zakat calculator (a calculator, not a fatwa).
 * - Nisab: 85 g of pure gold, or 595 g of silver (the user chooses).
 * - Rate: 2.5% of net zakatable wealth, when it reaches the nisab.
 * - By default: gold, silver, cash, crypto and stocks count; "other" assets (home, car…) do not.
 *   Worn jewelry is optional because scholars differ. Each asset can be switched on/off.
 */
import { TROY_OUNCE_GRAMS } from './catalog';
import { type Market, usdPerUnit, usdToSyp } from './calc/market';
import type { Holding } from './calc/portfolio';
import type { AssetType } from './model';

export const ZAKAT_RATE = 0.025;
export const NISAB_GOLD_GRAMS = 85;
export const NISAB_SILVER_GRAMS = 595;

const DEFAULT_TYPES: Record<AssetType, boolean> = {
  gold: true,
  silver: true,
  cash: true,
  crypto: true,
  stock: true,
  manual: false,
};

export type ZakatReason = 'type' | 'jewelry' | 'override' | 'noPrice' | 'empty';

export interface ZakatRow {
  holding: Holding;
  included: boolean;
  /** Why it is excluded (or 'override' when the user changed the default). */
  reason: ZakatReason | null;
  valueUsd: number | null;
  valueSyp: number | null;
  /** Grams of pure gold/silver, for "zakat in kind". */
  fineGrams: number | null;
}

export interface ZakatOptions {
  basis: 'gold' | 'silver';
  includeJewelry: boolean;
  overrides: Record<string, boolean>;
  debts: number;
  debtsCurrency: string;
}

export interface ZakatResult {
  rows: ZakatRow[];
  /** Value of the nisab, in USD and SYP, for both bases. */
  nisab: { gold: { usd: number | null; syp: number | null }; silver: { usd: number | null; syp: number | null } };
  nisabUsd: number | null;
  totalUsd: number;
  totalSyp: number | null;
  debtsUsd: number | null;
  netUsd: number;
  netSyp: number | null;
  /** null when the nisab is unknown (no metal prices yet). */
  reachesNisab: boolean | null;
  dueUsd: number;
  dueSyp: number | null;
  /** Zakat in kind for gold/silver that is counted: 2.5% of the pure grams. */
  goldGramsDue: number;
  silverGramsDue: number;
}

/** Value of one gram of pure metal in USD (Syrian market 24K price when local pricing is on). */
function gramValue(m: Market, metal: 'gold' | 'silver'): { usd: number | null; syp: number | null } {
  if (metal === 'gold') {
    const local = m.metalPricing === 'local' ? m.localGold['24K']?.buy : undefined;
    if (local != null) return { syp: local, usd: m.sypSell ? local / m.sypSell : null };
    const usd = m.xau == null ? null : m.xau / TROY_OUNCE_GRAMS;
    return { usd, syp: usdToSyp(m, usd) };
  }
  const usd = m.xag == null ? null : m.xag / TROY_OUNCE_GRAMS;
  return { usd, syp: usdToSyp(m, usd) };
}

/** Whether an asset counts before any per-asset override. */
export function defaultIncluded(a: Pick<Holding['asset'], 'type' | 'form'>, includeJewelry: boolean): boolean {
  if (!DEFAULT_TYPES[a.type]) return false;
  return !((a.type === 'gold' || a.type === 'silver') && a.form === 'jewelry' && !includeJewelry);
}

export function computeZakat(holdings: Holding[], m: Market, o: ZakatOptions): ZakatResult {
  const rows: ZakatRow[] = holdings.map((h) => {
    const a = h.asset;
    const isMetal = a.type === 'gold' || a.type === 'silver';
    let included = defaultIncluded(a, o.includeJewelry);
    let reason: ZakatReason | null = included ? null : DEFAULT_TYPES[a.type] ? 'jewelry' : 'type';
    const override = o.overrides[String(a.id)];
    if (override !== undefined && override !== included) {
      included = override;
      reason = 'override';
    }
    if (h.quantity <= 0) {
      included = false;
      reason = 'empty';
    } else if (included && h.valueUsd == null) {
      included = false;
      reason = 'noPrice';
    }
    const fineGrams = isMetal ? h.quantity * (a.unitGrams ?? 1) * (a.purity ?? 1) : null;
    return { holding: h, included, reason, valueUsd: h.valueUsd, valueSyp: h.valueSyp, fineGrams };
  });

  const gold = gramValue(m, 'gold');
  const silver = gramValue(m, 'silver');
  const nisab = {
    gold: { usd: gold.usd == null ? null : gold.usd * NISAB_GOLD_GRAMS, syp: gold.syp == null ? null : gold.syp * NISAB_GOLD_GRAMS },
    silver: {
      usd: silver.usd == null ? null : silver.usd * NISAB_SILVER_GRAMS,
      syp: silver.syp == null ? null : silver.syp * NISAB_SILVER_GRAMS,
    },
  };
  const nisabUsd = o.basis === 'gold' ? nisab.gold.usd : nisab.silver.usd;

  let totalUsd = 0;
  let totalSyp: number | null = 0;
  let goldGrams = 0;
  let silverGrams = 0;
  for (const r of rows) {
    if (!r.included) continue;
    totalUsd += r.valueUsd ?? 0;
    totalSyp = totalSyp == null || r.valueSyp == null ? null : totalSyp + r.valueSyp;
    if (r.holding.asset.type === 'gold') goldGrams += r.fineGrams ?? 0;
    if (r.holding.asset.type === 'silver') silverGrams += r.fineGrams ?? 0;
  }

  const rate = usdPerUnit(m, o.debtsCurrency);
  const debtsUsd = o.debts > 0 ? (rate == null ? null : o.debts * rate) : 0;
  const netUsd = Math.max(0, totalUsd - (debtsUsd ?? 0));
  const netSyp = totalSyp == null ? null : Math.max(0, totalSyp - (usdToSyp(m, debtsUsd ?? 0) ?? 0));
  const reachesNisab = nisabUsd == null ? null : netUsd >= nisabUsd && netUsd > 0;
  const due = reachesNisab === true;

  return {
    rows,
    nisab,
    nisabUsd,
    totalUsd,
    totalSyp,
    debtsUsd,
    netUsd,
    netSyp,
    reachesNisab,
    dueUsd: due ? netUsd * ZAKAT_RATE : 0,
    dueSyp: due && netSyp != null ? netSyp * ZAKAT_RATE : due ? null : 0,
    goldGramsDue: due ? goldGrams * ZAKAT_RATE : 0,
    silverGramsDue: due ? silverGrams * ZAKAT_RATE : 0,
  };
}
