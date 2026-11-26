export const TROY_OUNCE_GRAMS = 31.1034768;

export interface CoinInfo {
  /** CoinGecko id */
  id: string;
  symbol: string;
  name: string;
  /** Binance USDT pair, used as a backup price source */
  binance?: string;
  stable?: boolean;
}

export const COINS: CoinInfo[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin', binance: 'BTCUSDT' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum', binance: 'ETHUSDT' },
  { id: 'tether', symbol: 'USDT', name: 'Tether', stable: true },
  { id: 'usd-coin', symbol: 'USDC', name: 'USD Coin', binance: 'USDCUSDT', stable: true },
  { id: 'binancecoin', symbol: 'BNB', name: 'BNB', binance: 'BNBUSDT' },
  { id: 'solana', symbol: 'SOL', name: 'Solana', binance: 'SOLUSDT' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP', binance: 'XRPUSDT' },
  { id: 'dogecoin', symbol: 'DOGE', name: 'Dogecoin', binance: 'DOGEUSDT' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano', binance: 'ADAUSDT' },
  { id: 'tron', symbol: 'TRX', name: 'TRON', binance: 'TRXUSDT' },
  { id: 'the-open-network', symbol: 'TON', name: 'Toncoin', binance: 'TONUSDT' },
  { id: 'litecoin', symbol: 'LTC', name: 'Litecoin', binance: 'LTCUSDT' },
  { id: 'avalanche-2', symbol: 'AVAX', name: 'Avalanche', binance: 'AVAXUSDT' },
  { id: 'chainlink', symbol: 'LINK', name: 'Chainlink', binance: 'LINKUSDT' },
  { id: 'polkadot', symbol: 'DOT', name: 'Polkadot', binance: 'DOTUSDT' },
  { id: 'bitcoin-cash', symbol: 'BCH', name: 'Bitcoin Cash', binance: 'BCHUSDT' },
  { id: 'shiba-inu', symbol: 'SHIB', name: 'Shiba Inu', binance: 'SHIBUSDT' },
  { id: 'pax-gold', symbol: 'PAXG', name: 'PAX Gold', binance: 'PAXGUSDT' },
];

export function coinById(id: string): CoinInfo | undefined {
  return COINS.find((c) => c.id === id);
}

export interface CurrencyInfo {
  code: string;
  en: string;
  ar: string;
  flag: string;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', en: 'US Dollar', ar: 'دولار أمريكي', flag: '🇺🇸' },
  { code: 'SYP', en: 'Syrian Pound', ar: 'ليرة سورية', flag: '🇸🇾' },
  { code: 'EUR', en: 'Euro', ar: 'يورو', flag: '🇪🇺' },
  { code: 'TRY', en: 'Turkish Lira', ar: 'ليرة تركية', flag: '🇹🇷' },
  { code: 'SAR', en: 'Saudi Riyal', ar: 'ريال سعودي', flag: '🇸🇦' },
  { code: 'AED', en: 'UAE Dirham', ar: 'درهم إماراتي', flag: '🇦🇪' },
  { code: 'GBP', en: 'British Pound', ar: 'جنيه إسترليني', flag: '🇬🇧' },
  { code: 'QAR', en: 'Qatari Riyal', ar: 'ريال قطري', flag: '🇶🇦' },
  { code: 'KWD', en: 'Kuwaiti Dinar', ar: 'دينار كويتي', flag: '🇰🇼' },
  { code: 'BHD', en: 'Bahraini Dinar', ar: 'دينار بحريني', flag: '🇧🇭' },
  { code: 'OMR', en: 'Omani Rial', ar: 'ريال عماني', flag: '🇴🇲' },
  { code: 'JOD', en: 'Jordanian Dinar', ar: 'دينار أردني', flag: '🇯🇴' },
  { code: 'EGP', en: 'Egyptian Pound', ar: 'جنيه مصري', flag: '🇪🇬' },
  { code: 'LBP', en: 'Lebanese Pound', ar: 'ليرة لبنانية', flag: '🇱🇧' },
  { code: 'IQD', en: 'Iraqi Dinar', ar: 'دينار عراقي', flag: '🇮🇶' },
  { code: 'CHF', en: 'Swiss Franc', ar: 'فرنك سويسري', flag: '🇨🇭' },
  { code: 'CAD', en: 'Canadian Dollar', ar: 'دولار كندي', flag: '🇨🇦' },
  { code: 'AUD', en: 'Australian Dollar', ar: 'دولار أسترالي', flag: '🇦🇺' },
  { code: 'SEK', en: 'Swedish Krona', ar: 'كرونة سويدية', flag: '🇸🇪' },
  { code: 'NOK', en: 'Norwegian Krone', ar: 'كرونة نرويجية', flag: '🇳🇴' },
  { code: 'DKK', en: 'Danish Krone', ar: 'كرونة دنماركية', flag: '🇩🇰' },
  { code: 'CNY', en: 'Chinese Yuan', ar: 'يوان صيني', flag: '🇨🇳' },
  { code: 'JPY', en: 'Japanese Yen', ar: 'ين ياباني', flag: '🇯🇵' },
  { code: 'RUB', en: 'Russian Ruble', ar: 'روبل روسي', flag: '🇷🇺' },
];

export function currencyInfo(code: string): CurrencyInfo | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

/** Pseudo-currency used only in forms: old Syrian pounds (before 1 Jan 2026). Stored as SYP ÷ 100. */
export const SYP_OLD = 'SYP_OLD';
export const SYP_REDENOMINATION = 100;

export interface MetalUnitPreset {
  id: string;
  unit: 'g' | 'oz' | 'kg' | 'coin';
  grams: number;
  /** default fineness for coins */
  purity?: number;
}

export const GOLD_UNITS: MetalUnitPreset[] = [
  { id: 'g', unit: 'g', grams: 1 },
  { id: 'oz', unit: 'oz', grams: TROY_OUNCE_GRAMS },
  { id: 'sovereign', unit: 'coin', grams: 7.98805, purity: 22 / 24 },
  { id: 'ottoman', unit: 'coin', grams: 7.216, purity: 22 / 24 },
  { id: 'custom-coin', unit: 'coin', grams: 8 },
];

export const SILVER_UNITS: MetalUnitPreset[] = [
  { id: 'g', unit: 'g', grams: 1 },
  { id: 'oz', unit: 'oz', grams: TROY_OUNCE_GRAMS },
  { id: 'kg', unit: 'kg', grams: 1000 },
];

export const GOLD_KARATS = [24, 22, 21, 18, 14] as const;
export const SILVER_PURITIES = [0.999, 0.925, 0.9, 0.8] as const;

/** Nearest standard karat label (e.g. "21K") for a fineness, or null when it is not a standard karat. */
export function karatLabel(purity: number | null | undefined): string | null {
  if (purity == null) return null;
  const k = purity * 24;
  const r = Math.round(k);
  return Math.abs(k - r) < 0.06 && (GOLD_KARATS as readonly number[]).includes(r) ? `${r}K` : null;
}
