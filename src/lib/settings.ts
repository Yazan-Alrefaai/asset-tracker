export type Language = 'en' | 'ar';
export type Theme = 'system' | 'light' | 'dark';

/** What the menu bar / tray shows. */
export type TrayItem = 'usd' | 'gold21' | 'gold24' | 'xau' | 'xag' | 'btc' | 'spy' | 'total';
export const TRAY_ITEMS: TrayItem[] = ['usd', 'gold21', 'gold24', 'xau', 'xag', 'btc', 'spy', 'total'];

export interface Settings {
  language: Language;
  theme: Theme;
  /** Which currency is shown big; the other is shown small next to it. */
  mainCurrency: 'USD' | 'SYP';
  /** Also show old Syrian pounds (×100) next to new ones. */
  showOldSyp: boolean;
  /** How often to refresh metals, crypto and stocks (seconds). */
  refreshSeconds: number;
  /** Where the USD→SYP market rate comes from. */
  sypSource: 'sptoday' | 'manual';
  sypManualBuy: number | null;
  sypManualSell: number | null;
  /** sp-today city slug ('damascus' = "Syria - general"). */
  sypCity: string;
  /** Value gold with the Syrian market price per karat, or with the world (spot) price. */
  metalPricing: 'local' | 'global';
  lastBackupDate: string | null;

  /** Send system notifications when a price alert fires. */
  notifications: boolean;
  /** Prices shown in the menu bar (macOS) or tray tooltip (Windows). */
  trayItems: TrayItem[];
  /** Closing the window keeps the app running in the menu bar / tray (alerts keep working). */
  keepInTray: boolean;

  /** Zakat: nisab by 85 g of gold or 595 g of silver. */
  zakatBasis: 'gold' | 'silver';
  /** Zakat: count gold/silver jewelry that is worn (scholars differ). */
  zakatIncludeJewelry: boolean;
  /** Zakat: debts due now, deducted before the 2.5%. */
  zakatDebts: number;
  zakatDebtsCurrency: string;
  /** Zakat: portfolio ids to include (null = all). */
  zakatPortfolios: number[] | null;
  /** Zakat: per-asset include/exclude overrides (asset id → include). */
  zakatOverrides: Record<string, boolean>;

  /** Monthly spending limit for income & expenses (null = no budget). */
  budgetMonthly: number | null;
  budgetCurrency: 'USD' | 'SYP';
  /** Portfolio the budget watches (null = all portfolios). */
  budgetPortfolio: number | null;
  /** Notify at 80% and 100% of the budget. */
  budgetAlerts: boolean;
  /** Last budget warning sent, as "YYYY-MM:80" or "YYYY-MM:100" (so each one is sent once a month). */
  budgetNotified: string;
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'en',
  theme: 'system',
  mainCurrency: 'USD',
  showOldSyp: true,
  refreshSeconds: 60,
  sypSource: 'sptoday',
  sypManualBuy: null,
  sypManualSell: null,
  sypCity: 'damascus',
  metalPricing: 'local',
  lastBackupDate: null,
  notifications: true,
  trayItems: ['usd', 'gold21', 'btc'],
  keepInTray: true,
  zakatBasis: 'gold',
  zakatIncludeJewelry: true,
  zakatDebts: 0,
  zakatDebtsCurrency: 'USD',
  zakatPortfolios: null,
  zakatOverrides: {},
  budgetMonthly: null,
  budgetCurrency: 'USD',
  budgetPortfolio: null,
  budgetAlerts: true,
  budgetNotified: '',
};

export function initialLanguage(): Language {
  try {
    return navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

/** True when a stored value has the same kind of shape as the default (protects against broken rows). */
function fits(def: unknown, v: unknown): boolean {
  if (def === null) return v === null || typeof v === 'number' || typeof v === 'string' || Array.isArray(v);
  if (Array.isArray(def)) return Array.isArray(v);
  if (typeof def === 'object') return v !== null && typeof v === 'object' && !Array.isArray(v);
  return typeof v === typeof def;
}

/** Merge stored key/value rows (JSON values) over the defaults, ignoring unknown or broken entries. */
export function parseSettings(rows: { key: string; value: string }[]): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS, language: initialLanguage() };
  const target = s as unknown as Record<string, unknown>;
  const defaults = DEFAULT_SETTINGS as unknown as Record<string, unknown>;
  for (const { key, value } of rows) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    try {
      const v = JSON.parse(value);
      if (fits(defaults[key], v)) target[key] = v;
    } catch {
      /* ignore broken value */
    }
  }
  s.trayItems = s.trayItems.filter((x) => TRAY_ITEMS.includes(x));
  if (s.budgetCurrency !== 'USD' && s.budgetCurrency !== 'SYP') s.budgetCurrency = 'USD';
  if (s.budgetMonthly != null && !(typeof s.budgetMonthly === 'number' && s.budgetMonthly > 0)) s.budgetMonthly = null;
  if (s.budgetPortfolio != null && typeof s.budgetPortfolio !== 'number') s.budgetPortfolio = null;
  return s;
}

/** Small cache in localStorage so theme and language apply before the database loads. */
const UI_CACHE_KEY = 'asset-tracker:ui';

export function readUiCache(): Partial<Pick<Settings, 'language' | 'theme'>> {
  try {
    return JSON.parse(localStorage.getItem(UI_CACHE_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function writeUiCache(s: Pick<Settings, 'language' | 'theme'>): void {
  try {
    localStorage.setItem(UI_CACHE_KEY, JSON.stringify({ language: s.language, theme: s.theme }));
  } catch {
    /* storage may be unavailable */
  }
}
