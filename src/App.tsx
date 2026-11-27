import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
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
