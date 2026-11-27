import { Bell, ChartLine, Eye, EyeOff, HandCoins, LayoutDashboard, Receipt, RefreshCw, Settings, Wallet } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { useT } from '../i18n';
import { isTauri } from '../lib/platform';
import { useMarket } from '../state/derived';
import { refreshPrices } from '../state/prices';
import { go, type Route } from '../state/router';
import { PRICE_GROUPS, useStore } from '../state/store';
import { Flash, useFmt } from './Money';
import { Skeleton, Toaster, cx } from './ui';

function NavItem({ active, icon, label, href, badge = 0 }: { active: boolean; icon: ReactNode; label: string; href: string; badge?: number }) {
  return (
    <a
      href={href}
      className={cx(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
        active ? 'bg-accent/15 font-semibold text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
      )}
      aria-current={active ? 'page' : undefined}
    >
      <span className={active ? 'text-accent-ink' : 'text-muted'}>{icon}</span>
      <span className="flex-1">{label}</span>
      {badge > 0 && (
        <span className="animate-pop-in tnum min-w-[20px] rounded-full bg-accent px-1.5 text-center text-[11px] font-semibold leading-5 text-on-accent">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </a>
  );
}

/** Re-renders every 15 s so "updated 2 minutes ago" stays true. */
export function useTicker(ms = 15_000): void {
  const [, set] = useState(0);
  useEffect(() => {
    const id = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [ms]);
}

function MiniTicker() {
  const t = useT();
  const f = useFmt();
  const m = useMarket();
  const quotes = useStore((s) => s.quotes);
  const loading = useStore((s) => PRICE_GROUPS.some((g) => s.status[g].running));
  const rows: [string, string, number | null][] = [];
  if (m.sypBuy != null) rows.push([`USD → SYP`, `${f.num(m.sypBuy, 2, 2)} / ${f.num(m.sypSell, 2, 2)}`, m.sypBuy]);
  if (m.localGold['21K']) rows.push([`${t.types.gold} 21K / ${t.units.g}`, f.price(m.localGold['21K'].buy, 'SYP'), m.localGold['21K'].buy]);
  if (m.xau != null) rows.push([`${t.types.gold} / ${t.units.oz}`, f.price(m.xau, 'USD'), m.xau]);
  if (m.xag != null) rows.push([`${t.types.silver} / ${t.units.oz}`, f.price(m.xag, 'USD'), m.xag]);
  if (m.crypto.bitcoin != null) rows.push(['BTC', f.price(m.crypto.bitcoin, 'USD', { decimals: 0 }), m.crypto.bitcoin]);
  if (quotes['stock:SPY']) rows.push(['S&P 500 (SPY)', f.price(quotes['stock:SPY'].price, 'USD'), quotes['stock:SPY'].price]);
  if (!rows.length) {
    // First start with no saved prices: placeholders while the first prices arrive.
    return loading ? (
      <ul className="space-y-2" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <li key={i} className="flex justify-between gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-14" />
          </li>
        ))}
      </ul>
    ) : null;
  }
  return (
    <ul className="space-y-1.5 text-xs">
      {rows.map(([k, v, n]) => (
        <li key={k} className="flex items-baseline justify-between gap-2">
          <span className="truncate text-muted">{k}</span>
          <span className="tnum shrink-0 text-ink-2" dir="ltr">
            <Flash value={n}>{v}</Flash>
          </span>
        </li>
      ))}
    </ul>
  );
}

function PriceStatus() {
  const t = useT();
  const f = useFmt();
  useTicker();
  const status = useStore((s) => s.status);
  const running = PRICE_GROUPS.some((g) => status[g].running);
  const lastOk = PRICE_GROUPS.map((g) => status[g].lastOk).filter(Boolean).sort().pop() ?? null;
  const anyError = PRICE_GROUPS.some((g) => status[g].lastError);
  return (
    <button
      type="button"
      onClick={() => refreshPrices()}
      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-start text-xs text-muted hover:bg-surface-2 hover:text-ink"
      title={t.common.refresh}
    >
      <RefreshCw className={cx('h-3.5 w-3.5 shrink-0', running && 'animate-spin')} />
      <span className="flex-1 truncate">
        {running ? t.common.refreshing : lastOk ? t.common.updated(f.ago(lastOk)) : t.common.notUpdated}
      </span>
      <span className={cx('h-2 w-2 shrink-0 rounded-full', anyError ? 'bg-warn' : lastOk ? 'bg-pos' : 'bg-line')} aria-hidden />
    </button>
  );
}

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  const t = useT();
  const unread = useStore((s) => s.notices.reduce((n, x) => n + (x.read ? 0 : 1), 0));
  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-e border-line bg-surface">
        <div className="flex items-center gap-2.5 px-5 pb-4 pt-5">
          <img src="/app-icon.svg" alt="" className="h-8 w-8" />
          <span className="text-[15px] font-semibold text-ink">{t.appName}</span>
        </div>
        <nav className="flex flex-col gap-0.5 px-3">
          <NavItem href="#/" active={route.name === 'dashboard' || route.name === 'asset'} icon={<LayoutDashboard className="h-4 w-4" />} label={t.nav.dashboard} />
          <NavItem href="#/cashflow" active={route.name === 'cashflow'} icon={<Receipt className="h-4 w-4" />} label={t.nav.cashflow} />
          <NavItem href="#/prices" active={route.name === 'prices'} icon={<ChartLine className="h-4 w-4" />} label={t.nav.prices} />
          <NavItem href="#/alerts" active={route.name === 'alerts'} icon={<Bell className="h-4 w-4" />} label={t.nav.alerts} badge={unread} />
          <NavItem href="#/zakat" active={route.name === 'zakat'} icon={<HandCoins className="h-4 w-4" />} label={t.nav.zakat} />
          <NavItem href="#/portfolios" active={route.name === 'portfolios'} icon={<Wallet className="h-4 w-4" />} label={t.nav.portfolios} />
          <NavItem href="#/settings" active={route.name === 'settings'} icon={<Settings className="h-4 w-4" />} label={t.nav.settings} />
        </nav>
        <div className="mt-auto space-y-3 border-t border-line px-4 py-4">
          <button type="button" onClick={() => go('/prices')} className="block w-full text-start" aria-label={t.nav.prices}>
            <MiniTicker />
          </button>
          <PriceStatus />
          {!isTauri && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-[11px] leading-snug text-warn">{t.common.browserDemo}</p>}
        </div>
      </aside>
      <main id="main-scroll" className="min-w-0 flex-1 overflow-y-auto">
        {/* Keyed by page, so each page change plays a short fade-up. */}
        <div key={route.name === 'asset' ? `asset-${route.id}` : route.name} className="animate-page-in mx-auto max-w-6xl px-8 py-7">
          {children}
        </div>
      </main>
      <Toaster />
    </div>
  );
}

export function PageHeader({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export function PrivacyToggle() {
  const t = useT();
  const privacy = useStore((s) => s.privacy);
  return (
    <button
      type="button"
      onClick={() => useStore.setState({ privacy: !privacy })}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-line bg-surface px-3 text-sm text-ink-2 hover:bg-surface-2 hover:text-ink"
      aria-pressed={privacy}
    >
      {privacy ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      {privacy ? t.common.showNumbers : t.common.hideNumbers}
    </button>
  );
}
