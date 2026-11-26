import { Eye, EyeOff, Pin, PinOff, X } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { unitLabel } from '../components/assetText';
import { useTicker } from '../components/Layout';
import { Dual, Pnl, useFmt } from '../components/Money';
import { cx } from '../components/ui';
import { useT } from '../i18n';
import { computeHolding, summarize } from '../lib/calc/portfolio';
import { isTauri } from '../lib/platform';
import { portfolioName, useHoldings, useMarket } from '../state/derived';
import { PRICE_GROUPS, useStore } from '../state/store';
import { readWidgetConfig, saveWidgetConfig, widgetLabel, type WidgetKind } from '../state/widgets';

async function currentWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow();
}

function WidgetButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted transition hover:bg-surface-2 hover:text-ink"
    >
      {children}
    </button>
  );
}

function TotalBody({ portfolioId }: { portfolioId: number }) {
  const holdings = useHoldings(portfolioId === 0 ? 'all' : portfolioId);
  const s = useMemo(() => summarize(holdings), [holdings]);
  return (
    <div>
      <Dual usd={s.valueUsd} syp={s.valueSyp} size="lg" />
      <div className="mt-2">
        <Pnl usd={s.pnlUsd} syp={s.pnlSyp} pctUsd={s.pnlPct} pctSyp={s.pnlPctSyp} size="sm" showSecondary={false} />
      </div>
    </div>
  );
}

function PricesBody() {
  const t = useT();
  const f = useFmt();
  const m = useMarket();
  const spy = useStore((s) => s.quotes['stock:SPY']?.price ?? null);
  const rows: [string, string][] = [];
  if (m.sypBuy != null) rows.push(['USD → SYP', `${f.num(m.sypBuy, 2, 2)} / ${f.num(m.sypSell, 2, 2)}`]);
  if (m.localGold['21K']) rows.push([`${t.types.gold} 21K / ${t.units.g}`, f.price(m.localGold['21K'].buy, 'SYP')]);
  if (m.xau != null) rows.push([`${t.types.gold} / ${t.units.oz}`, f.price(m.xau, 'USD')]);
  if (m.xag != null) rows.push([`${t.types.silver} / ${t.units.oz}`, f.price(m.xag, 'USD')]);
  if (m.crypto.bitcoin != null) rows.push(['BTC', f.price(m.crypto.bitcoin, 'USD', { decimals: 0 })]);
  if (spy != null) rows.push(['S&P 500 (SPY)', f.price(spy, 'USD')]);
  return (
    <ul className="space-y-1.5 text-[13px]">
      {rows.map(([k, v]) => (
        <li key={k} className="flex items-baseline justify-between gap-3">
          <span className="truncate text-ink-2">{k}</span>
          <span className="tnum shrink-0 font-medium text-ink" dir="ltr">
            {v}
          </span>
        </li>
      ))}
    </ul>
  );
}

function AssetBody({ assetId }: { assetId: number }) {
  const t = useT();
  const f = useFmt();
  const m = useMarket();
  const asset = useStore((s) => s.assets.find((a) => a.id === assetId));
  const txs = useStore((s) => s.txs);
  if (!asset) return <p className="text-sm text-muted">{t.widgets.notFound}</p>;
  const h = computeHolding(asset, txs, m);
  return (
    <div>
      <Dual usd={h.valueUsd} syp={h.valueSyp} size="lg" />
      <div className="mt-2">
        <Pnl usd={h.pnlUsd} syp={h.pnlSyp} pctUsd={h.pnlPct} pctSyp={h.pnlPctSyp} size="sm" showSecondary={false} />
      </div>
      <p className="tnum mt-1 text-xs text-muted">
        {f.qty(h.quantity, asset.type)} {unitLabel(asset, t)}
      </p>
    </div>
  );
}

/** A small always-on-top window showing one live card. Drag it anywhere; it remembers where it was. */
export function WidgetView({ kind, refId }: { kind: WidgetKind; refId: number }) {
  const t = useT();
  const f = useFmt();
  useTicker(20_000);
  const privacy = useStore((s) => s.privacy);
  const portfolios = useStore((s) => s.portfolios);
  const asset = useStore((s) => (kind === 'asset' ? s.assets.find((a) => a.id === refId) : undefined));
  const status = useStore((s) => s.status);
  const quotes = useStore((s) => s.quotes);
  const [onTop, setOnTop] = useState(true);

  const lastUpdate = useMemo(() => {
    const times = Object.values(quotes).map((q) => q.fetchedAt).sort();
    const fromStatus = PRICE_GROUPS.map((g) => status[g].lastOk).filter(Boolean).sort();
    return fromStatus.pop() ?? times.pop() ?? null;
  }, [quotes, status]);

  useEffect(() => {
    document.title = t.appName;
    if (!isTauri) return;
    const stops: (() => void)[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      const win = await currentWindow();
      const cfg = await readWidgetConfig(win.label);
      if (cfg) setOnTop(cfg.onTop);
      const save = () => {
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const scale = await win.scaleFactor();
          const pos = (await win.outerPosition()).toLogical(scale);
          const size = (await win.innerSize()).toLogical(scale);
          const cur = (await readWidgetConfig(win.label)) ?? { label: win.label, kind, ref: refId, open: true, onTop: true };
          await saveWidgetConfig({
            ...cur,
            open: true,
            x: Math.round(pos.x),
            y: Math.round(pos.y),
            w: Math.round(size.width),
            h: Math.round(size.height),
          });
        }, 600);
      };
      stops.push(await win.onMoved(save), await win.onResized(save));
    })();
    return () => {
      clearTimeout(timer);
      stops.forEach((s) => s());
    };
  }, [kind, refId, t.appName]);

  async function togglePin() {
    const win = await currentWindow();
    const next = !onTop;
    await win.setAlwaysOnTop(next);
    setOnTop(next);
    const cur = await readWidgetConfig(win.label);
    if (cur) await saveWidgetConfig({ ...cur, onTop: next });
  }

  async function close() {
    if (!isTauri) return window.close();
    const win = await currentWindow();
    const cur = (await readWidgetConfig(win.label)) ?? { label: widgetLabel(kind, refId), kind, ref: refId, open: false, onTop };
    await saveWidgetConfig({ ...cur, open: false });
    await win.close();
  }

  const title =
    kind === 'prices'
      ? t.widgets.prices
      : kind === 'asset'
        ? (asset?.name ?? t.widgets.total)
        : refId === 0
          ? t.widgets.total
          : `${t.widgets.total} · ${portfolioName(portfolios.find((p) => p.id === refId), t)}`;

  return (
    <div
      className="flex h-full select-none flex-col bg-surface px-4 pb-3 pt-2.5"
      onMouseDown={(e) => {
        if (isTauri && e.button === 0 && !(e.target as HTMLElement).closest('button')) {
          void currentWindow().then((w) => w.startDragging());
        }
      }}
    >
      <div className="mb-2 flex items-center gap-1">
        <img src="/app-icon.svg" alt="" className="h-4 w-4" />
        <span className="flex-1 truncate ps-1 text-xs font-semibold text-ink-2">{title}</span>
        <WidgetButton label={privacy ? t.common.showNumbers : t.common.hideNumbers} onClick={() => useStore.setState({ privacy: !privacy })}>
          {privacy ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
        </WidgetButton>
        {isTauri && (
          <WidgetButton label={onTop ? t.widgets.unpin : t.widgets.pin} onClick={() => void togglePin()}>
            {onTop ? <Pin className="h-3.5 w-3.5" /> : <PinOff className="h-3.5 w-3.5" />}
          </WidgetButton>
        )}
        <WidgetButton label={t.widgets.close} onClick={() => void close()}>
          <X className="h-3.5 w-3.5" />
        </WidgetButton>
      </div>
      <div className={cx('min-h-0 flex-1 overflow-hidden')}>
        {kind === 'total' && <TotalBody portfolioId={refId} />}
        {kind === 'prices' && <PricesBody />}
        {kind === 'asset' && <AssetBody assetId={refId} />}
      </div>
      <p className="mt-1 truncate text-[11px] text-muted">{lastUpdate ? t.common.updated(f.ago(lastUpdate)) : t.common.notUpdated}</p>
    </div>
  );
}
