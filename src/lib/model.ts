export type AssetType = 'gold' | 'silver' | 'crypto' | 'stock' | 'cash' | 'manual';

/** Display order for charts and legends. It matches the validated colour-slot order (--s1 … --s6). */
export const ASSET_TYPES: AssetType[] = ['stock', 'crypto', 'silver', 'gold', 'manual', 'cash'];

export const TYPE_COLOR_VAR: Record<AssetType, string> = {
  stock: 'var(--s1)',
  crypto: 'var(--s2)',
  silver: 'var(--s3)',
  gold: 'var(--s4)',
  manual: 'var(--s5)',
  cash: 'var(--s6)',
};

export type PortfolioKind = 'personal' | 'business' | 'other';
export type TxKind = 'buy' | 'sell';
export type MetalForm = 'jewelry' | 'bar' | 'coin' | '';

export interface Portfolio {
  id: number;
  name: string;
  kind: PortfolioKind;
  sortOrder: number;
}

export interface Asset {
  id: number;
  portfolioId: number;
  type: AssetType;
  name: string;
  /** XAU/XAG for metals, CoinGecko id for crypto, ticker for stocks, currency code for cash. */
  symbol: string;
  /** Metals: g | oz | kg | coin. Others: 'unit'. */
  unit: string;
  /** Metals: grams per unit (1 for g, 31.1034768 for oz, coin weight for coins). */
  unitGrams: number | null;
  /** Metals: fineness 0..1 (21K = 0.875). */
  purity: number | null;
  form: MetalForm;
  /** Currency of the live price (stocks) or of the manual price. */
  priceCurrency: string | null;
  manualPrice: number | null;
  useManualPrice: boolean;
  location: string;
  notes: string;
  archived: boolean;
  createdAt: string;
}

export interface Tx {
  id: number;
  assetId: number;
  kind: TxKind;
  /** YYYY-MM-DD */
  date: string;
  quantity: number;
  /** Price per unit, in `currency`. */
  price: number;
  /** Always stored as a current code; old Syrian pounds are converted to new ones (÷100) on entry. */
  currency: string;
  /** Fees in `currency` (gold making charge goes here). */
  fees: number;
  /** Units of `currency` per 1 USD on that date (1 for USD). */
  usdRate: number;
  /** Syrian pounds (new) per 1 USD on that date, if known. */
  sypRate: number | null;
  notes: string;
  createdAt: string;
}

export interface Quote {
  key: string;
  price: number;
  bid: number | null;
  ask: number | null;
  currency: string;
  source: string;
  asOf: string | null;
  fetchedAt: string;
  extra: Record<string, unknown> | null;
}

export interface Snapshot {
  date: string;
  portfolioId: number;
  valueUsd: number;
  costUsd: number;
  valueSyp: number | null;
}

export type NewAsset = Omit<Asset, 'id' | 'createdAt'>;
export type NewTx = Omit<Tx, 'id' | 'createdAt'>;

export type AlertCondition = 'above' | 'below';

/**
 * A price alert. `target` says what to watch, e.g. "metal:XAU", "sygold:21K", "syp:USD",
 * "crypto:bitcoin", "stock:SPY", "total:USD", "total:SYP".
 */
export interface Alert {
  id: number;
  target: string;
  condition: AlertCondition;
  value: number;
  /** Notify every time it crosses again (true) or only once (false). */
  repeat: boolean;
  active: boolean;
  /** 'fired' = condition was met and we already notified; it re-arms when the price moves back. */
  state: 'armed' | 'fired';
  note: string;
  lastTriggeredAt: string | null;
  lastValue: number | null;
  createdAt: string;
}

export type NewAlert = Pick<Alert, 'target' | 'condition' | 'value' | 'repeat' | 'note'>;
