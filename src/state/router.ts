import { useEffect, useState } from 'react';
import type { WidgetKind } from './widgets';

export type Route =
  | { name: 'dashboard' }
  | { name: 'asset'; id: number; action?: 'buy' }
  | { name: 'cashflow' }
  | { name: 'prices' }
  | { name: 'alerts' }
  | { name: 'zakat' }
  | { name: 'portfolios' }
  | { name: 'settings' }
  | { name: 'widget'; kind: WidgetKind; ref: number };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'asset': {
      const id = Number(parts[1]);
      if (!Number.isInteger(id) || id <= 0) return { name: 'dashboard' };
      return parts[2] === 'buy' ? { name: 'asset', id, action: 'buy' } : { name: 'asset', id };
    }
    case 'cashflow':
      return { name: 'cashflow' };
    case 'prices':
      return { name: 'prices' };
    case 'alerts':
      return { name: 'alerts' };
    case 'zakat':
      return { name: 'zakat' };
    case 'portfolios':
      return { name: 'portfolios' };
    case 'settings':
      return { name: 'settings' };
    case 'widget': {
      const kind = parts[1];
      const ref = Number(parts[2] ?? 0);
      if (kind === 'prices') return { name: 'widget', kind, ref: 0 };
      if ((kind === 'total' || kind === 'asset') && Number.isInteger(ref) && ref >= 0) return { name: 'widget', kind, ref };
      return { name: 'dashboard' };
    }
    default:
      return { name: 'dashboard' };
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(parseHash(window.location.hash));
      document.getElementById('main-scroll')?.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function go(path: string): void {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}
