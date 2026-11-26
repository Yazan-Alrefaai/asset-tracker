import { isTauri } from './platform';
import { APP_USER_AGENT } from './hosts';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    url: string,
  ) {
    super(`HTTP ${status} from ${new URL(url).hostname}`);
  }
}

/**
 * GET a URL as text.
 * - In the desktop app the request goes through Rust (no CORS limits, honest User-Agent).
 * - In a browser tab it goes through the Vite dev proxy (`npm run dev` only).
 */
export async function httpText(url: string, timeoutMs = 15_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res: Response;
    if (isTauri) {
      const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
      res = await tauriFetch(url, {
        method: 'GET',
        headers: { 'User-Agent': APP_USER_AGENT, Accept: '*/*' },
        signal: controller.signal,
      });
    } else {
      res = await fetch(`/__proxy?url=${encodeURIComponent(url)}`, { signal: controller.signal });
    }
    if (!res.ok) throw new HttpError(res.status, url);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function httpJson<T = unknown>(url: string, timeoutMs?: number): Promise<T> {
  return JSON.parse(await httpText(url, timeoutMs)) as T;
}
