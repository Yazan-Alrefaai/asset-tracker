import { useEffect, useState } from 'react';

export type Route =
  | { name: 'dashboard' }
  | { name: 'asset'; id: number; action?: 'buy' }
  | { name: 'prices' }
  | { name: 'portfolios' }
  | { name: 'settings' };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (parts[0]) {
    case 'asset': {
      const id = Number(parts[1]);
      if (!Number.isInteger(id) || id <= 0) return { name: 'dashboard' };
      return parts[2] === 'buy' ? { name: 'asset', id, action: 'buy' } : { name: 'asset', id };
    }
    case 'prices':
      return { name: 'prices' };
    case 'portfolios':
      return { name: 'portfolios' };
    case 'settings':
      return { name: 'settings' };
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
