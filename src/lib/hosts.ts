/** Hosts the app may contact for prices. Keep in sync with src-tauri/capabilities/default.json. */
export const PRICE_HOSTS = [
  'api.gold-api.com',
  'forex-data-feed.swissquote.com',
  'api.coingecko.com',
  'api.binance.com',
  'query1.finance.yahoo.com',
  'query2.finance.yahoo.com',
  'open.er-api.com',
  'api.frankfurter.dev',
  'sp-today.com',
] as const;

/** Honest identification for price requests (all sources accept it; Yahoo rejects requests without one). */
export const APP_USER_AGENT = 'AssetTracker/0.1 (personal portfolio app)';
