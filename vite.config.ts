import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { PRICE_HOSTS, APP_USER_AGENT } from './src/lib/hosts.ts';

const host = process.env.TAURI_DEV_HOST;

/**
 * Dev-only proxy so the app can also run in a normal browser tab (`npm run dev`)
 * without CORS errors. Inside the Tauri app, requests go through the Rust HTTP plugin instead.
 * Only the price hosts in src/lib/hosts.ts are allowed.
 */
function devPriceProxy(): Plugin {
  const allowed = new Set<string>(PRICE_HOSTS);
  return {
    name: 'dev-price-proxy',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__proxy', async (req, res) => {
        try {
          const target = new URL(new URL(req.url ?? '', 'http://local').searchParams.get('url') ?? '');
          if (target.protocol !== 'https:' || !allowed.has(target.hostname)) {
            res.statusCode = 403;
            res.end('host not allowed');
            return;
          }
          const upstream = await fetch(target, {
            headers: { 'user-agent': APP_USER_AGENT, accept: String(req.headers.accept ?? '*/*') },
          });
          res.statusCode = upstream.status;
          res.setHeader('content-type', upstream.headers.get('content-type') ?? 'text/plain');
          res.end(Buffer.from(await upstream.arrayBuffer()));
        } catch (e) {
          res.statusCode = 502;
          res.end(String(e));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), devPriceProxy()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: 'ws', host, port: 1421 } : undefined,
    watch: { ignored: ['**/src-tauri/**'] },
  },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    // Tauri uses WebView2 (Chromium) on Windows and WebKit on macOS.
    target: ['es2021', 'chrome105', 'safari15'],
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // A desktop app loads from disk, so one bigger chunk is fine.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
});
