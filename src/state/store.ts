import { create } from 'zustand';
import type { Asset, Portfolio, Quote, Snapshot, Tx } from '../lib/model';
import type { SpCity } from '../lib/prices/sptoday';
import { DEFAULT_SETTINGS, initialLanguage, readUiCache, type Settings } from '../lib/settings';

export type PriceGroup = 'metals' | 'syp' | 'crypto' | 'stocks' | 'fx';
export const PRICE_GROUPS: PriceGroup[] = ['metals', 'syp', 'crypto', 'stocks', 'fx'];

export interface GroupStatus {
  running: boolean;
  /** ms timestamp of the last attempt */
  lastAttempt: number;
  lastOk: string | null;
  lastError: string | null;
}

export interface Toast {
  id: number;
  text: string;
  kind: 'ok' | 'error';
}

export interface AppState {
  ready: boolean;
  bootError: string | null;
  settings: Settings;
  portfolios: Portfolio[];
  assets: Asset[];
  txs: Tx[];
  snapshots: Snapshot[];
  quotes: Record<string, Quote>;
  status: Record<PriceGroup, GroupStatus>;
  spCities: SpCity[];
  privacy: boolean;
  portfolioFilter: number | 'all';
  toasts: Toast[];
}

const cachedUi = readUiCache();
const idle = (): GroupStatus => ({ running: false, lastAttempt: 0, lastOk: null, lastError: null });

export const useStore = create<AppState>(() => ({
  ready: false,
  bootError: null,
  settings: {
    ...DEFAULT_SETTINGS,
    language: cachedUi.language ?? initialLanguage(),
    theme: cachedUi.theme ?? 'system',
  },
  portfolios: [],
  assets: [],
  txs: [],
  snapshots: [],
  quotes: {},
  status: { metals: idle(), syp: idle(), crypto: idle(), stocks: idle(), fx: idle() },
  spCities: [],
  privacy: false,
  portfolioFilter: 'all',
  toasts: [],
}));

let toastSeq = 0;

export function toast(text: string, kind: Toast['kind'] = 'ok'): void {
  const id = ++toastSeq;
  useStore.setState((s) => ({ toasts: [...s.toasts, { id, text, kind }] }));
  setTimeout(() => useStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4500);
}

export function errorText(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}
