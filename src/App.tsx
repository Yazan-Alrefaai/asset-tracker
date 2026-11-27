import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { Skeleton, Spinner } from './components/ui';
import { MESSAGES } from './i18n';
import { AlertsPage } from './pages/AlertsPage';
import { AssetPage } from './pages/AssetPage';
import { CashflowPage } from './pages/CashflowPage';
import { Dashboard } from './pages/Dashboard';
import { PortfoliosPage } from './pages/PortfoliosPage';
import { PricesPage } from './pages/PricesPage';
import { SettingsPage } from './pages/SettingsPage';
import { WidgetView } from './pages/WidgetView';
import { ZakatPage } from './pages/ZakatPage';
import { boot, bootWidget } from './state/actions';
import { parseHash, useRoute } from './state/router';
import { useStore } from './state/store';

/** Widget windows open straight on a "#/widget/…" address and never become the main window. */
const IS_WIDGET_WINDOW = parseHash(window.location.hash).name === 'widget';

function useDocumentLanguage(): void {
  const lang = useStore((s) => s.settings.language);
  useEffect(() => {
    const el = document.documentElement;
    el.lang = lang;
    el.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = MESSAGES[lang].appName;
  }, [lang]);
}

function useTheme(): void {
  const theme = useStore((s) => s.settings.theme);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () =>
      document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches));
    apply();
    if (theme !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [theme]);
}

/** First screen while the database opens: the app's own shape, softly loading (no blank flash). */
function BootScreen({ name, loading }: { name: string; loading: string }) {
  return (
    <div className="flex h-full" aria-busy="true">
      <div className="fixed inset-x-0 top-0 z-10 h-0.5 overflow-hidden" aria-hidden>
        <div className="animate-progress-indeterminate h-full w-full origin-left bg-accent" />
      </div>
      <aside className="flex w-60 shrink-0 flex-col gap-6 border-e border-line bg-surface px-5 py-5">
        <div className="flex items-center gap-2.5">
          <img src="/app-icon.svg" alt="" className="animate-breathe h-8 w-8" />
          <span className="text-[15px] font-semibold text-ink">{name}</span>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-8 py-7">
        <div className="mx-auto max-w-6xl">
          <Skeleton className="mb-6 h-7 w-48" />
          <div className="grid grid-cols-4 gap-4">
            <Skeleton className="col-span-2 h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </div>
          <div className="mt-4 grid grid-cols-5 gap-4">
            <Skeleton className="col-span-2 h-64 rounded-xl" />
            <Skeleton className="col-span-3 h-64 rounded-xl" />
          </div>
        </div>
      </main>
      <span className="sr-only" role="status">
        {loading}
      </span>
    </div>
  );
}

export default function App() {
  const ready = useStore((s) => s.ready);
  const bootError = useStore((s) => s.bootError);
  const lang = useStore((s) => s.settings.language);
  const route = useRoute();
  useDocumentLanguage();
  useTheme();

  useEffect(() => {
    void (IS_WIDGET_WINDOW ? bootWidget() : boot());
  }, []);

  const t = MESSAGES[lang];

  if (bootError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-neg/40 bg-surface p-6 text-center shadow-card">
          <TriangleAlert className="mx-auto h-8 w-8 text-neg" />
          <p className="mt-3 font-semibold text-ink">{t.common.somethingWrong}</p>
          <p className="mt-2 break-words font-mono text-xs text-ink-2">{bootError}</p>
        </div>
      </div>
    );
  }

  if (!ready && !IS_WIDGET_WINDOW) return <BootScreen name={t.appName} loading={t.common.loading} />;

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center gap-3 text-muted">
        <Spinner className="h-5 w-5" />
        {IS_WIDGET_WINDOW ? null : t.common.loading}
      </div>
    );
  }

  if (route.name === 'widget') return <WidgetView key={`${route.kind}-${route.ref}`} kind={route.kind} refId={route.ref} />;

  return (
    <Layout route={route}>
      {route.name === 'dashboard' && <Dashboard />}
      {route.name === 'asset' && <AssetPage key={route.id} id={route.id} action={route.action} />}
      {route.name === 'cashflow' && <CashflowPage />}
      {route.name === 'prices' && <PricesPage />}
      {route.name === 'alerts' && <AlertsPage />}
      {route.name === 'zakat' && <ZakatPage />}
      {route.name === 'portfolios' && <PortfoliosPage />}
      {route.name === 'settings' && <SettingsPage />}
    </Layout>
  );
}
