export type Language = 'en' | 'ar';
export type Theme = 'system' | 'light' | 'dark';

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
};

export function initialLanguage(): Language {
  try {
    return navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

/** Merge stored key/value rows (JSON values) over the defaults, ignoring unknown or broken entries. */
export function parseSettings(rows: { key: string; value: string }[]): Settings {
  const s: Settings = { ...DEFAULT_SETTINGS, language: initialLanguage() };
  const target = s as unknown as Record<string, unknown>;
  for (const { key, value } of rows) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    try {
      target[key] = JSON.parse(value);
    } catch {
      /* ignore broken value */
    }
  }
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
