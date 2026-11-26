import { Plus, TriangleAlert, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AllocationBar } from '../components/AllocationBar';
import { AssetForm } from '../components/AssetForm';
import { AssetIcon } from '../components/AssetIcon';
import { assetDetails, unitLabel } from '../components/assetText';
import { HistoryChart, type HistoryPoint } from '../components/HistoryChart';
import { PageHeader, PrivacyToggle, useTicker } from '../components/Layout';
import { Dual, Pnl, useFmt } from '../components/Money';
import { Badge, Button, Card, EmptyState, Select } from '../components/ui';
import { useT } from '../i18n';
import { summarize, type Holding } from '../lib/calc/portfolio';
import { portfolioName, useHoldings, useMarket } from '../state/derived';
import { go } from '../state/router';
import { useStore } from '../state/store';

export function PortfolioFilter() {
  const t = useT();
  const portfolios = useStore((s) => s.portfolios);
  const filter = useStore((s) => s.portfolioFilter);
  if (portfolios.length < 2) return null;
  return (
    <Select
      aria-label={t.nav.portfolios}
      value={String(filter)}
      onChange={(e) => useStore.setState({ portfolioFilter: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
      className="w-auto min-w-[170px]"
    >
      <option value="all">{t.common.allPortfolios}</option>
      {portfolios.map((p) => (
        <option key={p.id} value={p.id}>
          {portfolioName(p, t)}
        </option>
      ))}
    </Select>
  );
}

function StatTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <p className="text-[13px] text-ink-2">{label}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function HoldingRow({ h }: { h: Holding }) {
  const t = useT();
  const f = useFmt();
  const a = h.asset;
  const sypFirst = f.main === 'SYP';
  const perUnit = (usd: number | null, syp: number | null) =>
    sypFirst && syp != null ? f.money(syp, 'SYP') : usd != null ? f.money(usd, 'USD') : '—';
  const unitPrice =
    sypFirst && h.unit.syp != null ? f.price(h.unit.syp, 'SYP') : h.unit.usd != null ? f.price(h.unit.usd, 'USD') : '—';
  const sold = h.quantity === 0 && h.txCount > 0;
  return (
    <tr className="cursor-pointer border-t border-line transition hover:bg-surface-2/60" onClick={() => go(`/asset/${a.id}`)}>
      <td className="py-3 pe-3 ps-5">
        <div className="flex items-center gap-3">
          <AssetIcon type={a.type} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 truncate text-sm font-medium text-ink">
              {a.name}
              {sold && <Badge>{t.dashboard.soldOut}</Badge>}
              {h.oversold && <TriangleAlert className="h-3.5 w-3.5 text-warn" aria-label={t.asset.oversold} />}
            </div>
            <div className="truncate text-xs text-muted">{assetDetails(a, t, f.lang)}</div>
          </div>
        </div>
      </td>
      <td className="tnum px-3 py-3 text-end text-sm text-ink">
        {f.qty(h.quantity, a.type)} <span className="text-xs text-muted">{unitLabel(a, t)}</span>
      </td>
      <td className="tnum px-3 py-3 text-end text-sm text-ink-2">{perUnit(h.avgCostUsd, h.avgCostSyp)}</td>
      <td className="tnum px-3 py-3 text-end text-sm text-ink-2">
        {unitPrice}
        {h.unit.basis === 'none' && <div className="text-xs text-warn">{t.basis.none}</div>}
      </td>
      <td className="px-3 py-3 text-end">
        {sold ? <span className="text-sm text-muted">—</span> : <Dual usd={h.valueUsd} syp={h.valueSyp} size="sm" />}
      </td>
      <td className="py-3 pe-5 ps-3 text-end">
        {sold ? (
          <Pnl usd={h.realizedUsd} syp={h.realizedSyp} pctUsd={null} pctSyp={null} size="sm" showSecondary={false} />
        ) : (
          <Pnl usd={h.pnlUsd} syp={h.pnlSyp} pctUsd={h.pnlPct} pctSyp={h.pnlPctSyp} size="sm" />
        )}
      </td>
    </tr>
  );
}

export function Dashboard() {
  const t = useT();
  const f = useFmt();
  const m = useMarket();
  useTicker(30_000);
  const filter = useStore((s) => s.portfolioFilter);
  const snapshots = useStore((s) => s.snapshots);
  const holdings = useHoldings(filter);
  const summary = useMemo(() => summarize(holdings), [holdings]);
  const [adding, setAdding] = useState(false);

  const sorted = useMemo(
    () =>
      [...holdings].sort((a, b) => {
        if ((a.quantity === 0) !== (b.quantity === 0)) return a.quantity === 0 ? 1 : -1;
        return (b.valueUsd ?? -1) - (a.valueUsd ?? -1);
      }),
    [holdings],
  );

  const historyCurrency = f.main === 'SYP' && summary.valueSyp != null ? 'SYP' : 'USD';
  const points: HistoryPoint[] = useMemo(() => {
    const pid = filter === 'all' ? 0 : filter;
    return snapshots
      .filter((s) => s.portfolioId === pid)
      .map((s) => ({ date: s.date, value: historyCurrency === 'SYP' ? s.valueSyp : s.valueUsd }))
      .filter((p): p is HistoryPoint => p.value != null);
  }, [snapshots, filter, historyCurrency]);

  const header = (
    <PageHeader title={t.dashboard.title}>
      <PortfolioFilter />
      <PrivacyToggle />
      <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
        {t.dashboard.addAsset}
      </Button>
    </PageHeader>
  );

  const form = adding && (
    <AssetForm
      open
      onClose={() => setAdding(false)}
      defaultPortfolioId={filter === 'all' ? undefined : filter}
      onCreated={(id) => go(`/asset/${id}/buy`)}
    />
  );

  if (!holdings.length) {
    return (
      <>
        {header}
        <Card>
          <EmptyState
            icon={<Wallet className="h-10 w-10" />}
            title={t.dashboard.emptyTitle}
            body={t.dashboard.emptyBody}
            action={
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>
                {t.dashboard.addAsset}
              </Button>
            }
          />
        </Card>
        {form}
      </>
    );
  }

  return (
    <>
      {header}
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-2 rounded-xl border border-line bg-surface p-5 shadow-card">
          <p className="text-[13px] text-ink-2">{t.dashboard.totalValue}</p>
          <Dual usd={summary.valueUsd} syp={summary.valueSyp} size="hero" className="mt-2" />
          {summary.missing > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-warn">
              <TriangleAlert className="h-3.5 w-3.5" />
              {t.dashboard.missing(summary.missing)}
            </p>
          )}
        </div>
        <StatTile label={t.dashboard.pnl}>
          <Pnl usd={summary.pnlUsd} syp={summary.pnlSyp} pctUsd={summary.pnlPct} pctSyp={summary.pnlPctSyp} size="lg" />
        </StatTile>
        <div className="grid gap-4">
          <StatTile label={t.dashboard.paid}>
            <Dual usd={summary.costUsd} syp={summary.costSyp} size="md" />
          </StatTile>
          {(summary.realizedUsd !== 0 || (summary.realizedSyp ?? 0) !== 0) && (
            <StatTile label={t.dashboard.realized}>
              <Pnl usd={summary.realizedUsd} syp={summary.realizedSyp} pctUsd={null} pctSyp={null} size="sm" />
            </StatTile>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-4">
        <Card title={t.dashboard.allocation} className="col-span-2">
          <AllocationBar slices={summary.slices} market={m} />
        </Card>
        <Card title={`${t.dashboard.history} (${historyCurrency})`} className="col-span-3">
          <HistoryChart points={points} currency={historyCurrency} />
        </Card>
      </div>

      <Card title={t.dashboard.holdings} className="mt-4" bodyClassName="p-0 pt-3">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="text-xs text-muted">
                <th className="pb-2 pe-3 ps-5 text-start font-medium">{t.dashboard.colAsset}</th>
                <th className="px-3 pb-2 text-end font-medium">{t.dashboard.colAmount}</th>
                <th className="px-3 pb-2 text-end font-medium">{t.dashboard.colAvgCost}</th>
                <th className="px-3 pb-2 text-end font-medium">{t.dashboard.colPrice}</th>
                <th className="px-3 pb-2 text-end font-medium">{t.dashboard.colValue}</th>
                <th className="pb-2 pe-5 ps-3 text-end font-medium">{t.dashboard.colPnl}</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((h) => (
                <HoldingRow key={h.asset.id} h={h} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {form}
    </>
  );
}
