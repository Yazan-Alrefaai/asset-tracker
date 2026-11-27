import { Copy, Download, Minus, Pencil, Plus, Receipt, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { CashflowChart, EXPENSE_COLOR, INCOME_COLOR } from '../components/CashflowChart';
import { FlowForm, type FlowFormProps } from '../components/FlowForm';
import { categoryLabel } from '../components/flowText';
import { PageHeader, PrivacyToggle } from '../components/Layout';
import { Dual, Pnl, useFmt } from '../components/Money';
import { Badge, Button, Card, ConfirmModal, EmptyState, IconButton, Segmented, Select, cx } from '../components/ui';
import { useT } from '../i18n';
import { cashflowsCsv } from '../lib/backup';
import {
  byCategory,
  filterFlows,
  flowSyp,
  flowUsd,
  monthOf,
  monthlySeries,
  monthsInPeriod,
  monthsWithData,
  parsePeriod,
  periodToString,
  shiftMonth,
  sortNewestFirst,
  summarizeFlows,
  yearsWithData,
  type CategorySlice,
  type Period,
} from '../lib/cashflow';
import { todayLocal } from '../lib/dates';
import { fmtMonth, fmtPct } from '../lib/format';
import type { CashFlow, FlowKind } from '../lib/model';
import { removeCashFlow } from '../state/actions';
import { portfolioName } from '../state/derived';
import { saveTextFile } from '../state/files';
import { errorText, toast, useStore } from '../state/store';
import { PortfolioFilter } from './Dashboard';

const PAGE = 100;

function Tile({ label, children, footer }: { label: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-card">
      <p className="text-[13px] text-ink-2">{label}</p>
      <div className="mt-2">{children}</div>
      {footer && <p className="mt-2 text-xs text-muted">{footer}</p>}
    </div>
  );
}

function PeriodSelect({ value, onChange, flows }: { value: Period; onChange: (p: Period) => void; flows: CashFlow[] }) {
  const t = useT();
  const f = useFmt();
  const thisMonth = monthOf(todayLocal());
  const lastMonth = shiftMonth(thisMonth, -1);
  const thisYear = thisMonth.slice(0, 4);
  const quick = [
    { v: `m:${thisMonth}`, label: t.cashflow.thisMonth },
    { v: `m:${lastMonth}`, label: t.cashflow.lastMonth },
    { v: `y:${thisYear}`, label: t.cashflow.thisYear },
    { v: 'all', label: t.cashflow.allTime },
  ];
  const taken = new Set(quick.map((q) => q.v));
  const months = monthsWithData(flows).filter((m) => !taken.has(`m:${m}`));
  const years = yearsWithData(flows).filter((y) => !taken.has(`y:${y}`));
  const current = periodToString(value);
  const known = taken.has(current) || months.some((m) => `m:${m}` === current) || years.some((y) => `y:${y}` === current);
  return (
    <Select aria-label={t.cashflow.period} value={current} onChange={(e) => onChange(parsePeriod(e.target.value))} className="w-auto min-w-[170px]">
      {quick.map((q) => (
        <option key={q.v} value={q.v}>
          {q.label}
        </option>
      ))}
      {!known && <option value={current}>{value.kind === 'month' ? fmtMonth(value.key, f.lang) : value.kind === 'year' ? value.key : ''}</option>}
      {months.length > 0 && (
        <optgroup label={t.cashflow.months}>
          {months.map((m) => (
            <option key={m} value={`m:${m}`}>
              {fmtMonth(m, f.lang)}
            </option>
          ))}
        </optgroup>
      )}
      {years.length > 0 && (
        <optgroup label={t.cashflow.years}>
          {years.map((y) => (
            <option key={y} value={`y:${y}`}>
              {y}
            </option>
          ))}
        </optgroup>
      )}
    </Select>
  );
}

function Breakdown({
  title,
  kind,
  slices,
  selected,
  onSelect,
}: {
  title: string;
  kind: FlowKind;
  slices: CategorySlice[];
  selected: string | null;
  onSelect: (c: string | null) => void;
}) {
  const t = useT();
  const f = useFmt();
  const color = kind === 'income' ? INCOME_COLOR : EXPENSE_COLOR;
  const amount = (s: CategorySlice) => (f.main === 'SYP' && s.syp != null ? f.money(s.syp, 'SYP') : f.money(s.usd, 'USD'));
  return (
    <Card title={title}>
      {slices.length === 0 ? (
        <p className="text-sm text-muted">—</p>
      ) : (
        <ul className="space-y-1">
          {slices.map((s) => {
            const active = selected === s.category;
            return (
              <li key={s.category}>
                <button
                  type="button"
                  onClick={() => onSelect(active ? null : s.category)}
                  title={active ? t.cashflow.clearCategory : t.cashflow.filterByCategory}
                  aria-pressed={active}
                  className={cx(
                    'w-full rounded-lg px-2 py-1.5 text-start transition hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
                    active && 'bg-accent/10',
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="truncate text-ink">{categoryLabel(kind, s.category, t)}</span>
                    <span className="flex shrink-0 items-baseline gap-3">
                      <span className="tnum text-ink">{amount(s)}</span>
                      <span className="tnum w-12 text-end text-xs text-muted">{Math.round(s.share * 1000) / 10}%</span>
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-surface-2" aria-hidden>
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, s.share * 100)}%`, backgroundColor: color }} />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function FlowRow({
  x,
  showPortfolio,
  onEdit,
  onCopy,
  onDelete,
}: {
  x: CashFlow;
  showPortfolio: boolean;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const f = useFmt();
  const portfolios = useStore((s) => s.portfolios);
  const income = x.kind === 'income';
  const syp = flowSyp(x);
  const usd = flowUsd(x);
  const other =
    f.main === 'SYP' && x.currency !== 'SYP' && syp != null
      ? f.money(syp, 'SYP')
      : x.currency !== 'USD'
        ? f.money(usd, 'USD')
        : syp != null
          ? f.money(syp, 'SYP')
          : null;
  return (
    <tr className="group border-t border-line">
      <td className="tnum whitespace-nowrap py-2.5 pe-3 ps-5 text-sm text-ink-2">{f.date(x.date)}</td>
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-2 text-sm text-ink">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: income ? INCOME_COLOR : EXPENSE_COLOR }} aria-hidden />
          <span className="truncate">{categoryLabel(x.kind, x.category, t)}</span>
          <Badge>{income ? t.cashflow.income : t.cashflow.expense}</Badge>
        </div>
      </td>
      <td className="max-w-[260px] truncate px-3 py-2.5 text-sm text-ink-2" title={x.note}>
        {x.note}
      </td>
      {showPortfolio && (
        <td className="whitespace-nowrap px-3 py-2.5 text-sm text-ink-2">{portfolioName(portfolios.find((p) => p.id === x.portfolioId), t)}</td>
      )}
      <td className="whitespace-nowrap px-3 py-2.5 text-end">
        <div className={cx('tnum text-sm font-medium', income ? 'text-pos' : 'text-ink')}>
          {/* The sign goes inside the formatted (bidi-isolated) amount, so it stays on the left in Arabic too. */}
          {f.money(income ? x.amount : -x.amount, x.currency, { sign: true })}
        </div>
        {other && <div className="tnum text-xs text-muted">≈ {other}</div>}
      </td>
      <td className="py-2.5 pe-4 ps-1">
        <div className="flex justify-end gap-0.5 opacity-70 transition group-hover:opacity-100">
          <IconButton label={t.cashflow.duplicate} onClick={onCopy}>
            <Copy className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label={t.common.edit} onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton label={t.common.delete} className="hover:text-neg" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}

export function CashflowPage() {
  const t = useT();
  const f = useFmt();
  const flows = useStore((s) => s.cashflows);
  const portfolios = useStore((s) => s.portfolios);
  const portfolioFilter = useStore((s) => s.portfolioFilter);
  const today = todayLocal();
  const [period, setPeriod] = useState<Period>(() => ({ kind: 'month', key: monthOf(today) }));
  const [kindFilter, setKindFilter] = useState<FlowKind | 'all'>('all');
  const [category, setCategory] = useState<{ kind: FlowKind; name: string } | null>(null);
  const [form, setForm] = useState<Omit<FlowFormProps, 'onClose'> | null>(null);
  const [toDelete, setToDelete] = useState<CashFlow | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const inPortfolio = useMemo(() => filterFlows(flows, { portfolioId: portfolioFilter, period: { kind: 'all' } }), [flows, portfolioFilter]);
  const inPeriod = useMemo(() => filterFlows(inPortfolio, { portfolioId: 'all', period }), [inPortfolio, period]);
  const summary = useMemo(() => summarizeFlows(inPeriod), [inPeriod]);
  const expenseSlices = useMemo(() => byCategory(inPeriod, 'expense'), [inPeriod]);
  const incomeSlices = useMemo(() => byCategory(inPeriod, 'income'), [inPeriod]);
  const listed = useMemo(
    () =>
      sortNewestFirst(
        inPeriod.filter(
          (x) =>
            (kindFilter === 'all' || x.kind === kindFilter) &&
            (!category || (x.kind === category.kind && x.category === category.name)),
        ),
      ),
    [inPeriod, kindFilter, category],
  );

  const thisMonth = monthOf(today);
  const chartEnd =
    period.kind === 'month' ? period.key : period.kind === 'year' && period.key < thisMonth.slice(0, 4) ? `${period.key}-12` : thisMonth;
  const series = useMemo(() => monthlySeries(inPortfolio, chartEnd, 12), [inPortfolio, chartEnd]);
  const chartCurrency = f.main === 'SYP' && series.every((p) => p.incomeSyp != null && p.expenseSyp != null) ? 'SYP' : 'USD';

  const months = monthsInPeriod(period, inPortfolio, today);
  const perMonth = (usd: number, syp: number | null) =>
    period.kind === 'month' || (usd === 0 && !syp)
      ? undefined
      : t.cashflow.perMonth(f.main === 'SYP' && syp != null ? f.money(syp / months, 'SYP') : f.money(usd / months, 'USD'));
  const sypMissing = summary.netSyp == null;
  const defaultPortfolioId = portfolioFilter === 'all' ? undefined : portfolioFilter;

  function selectCategory(kind: FlowKind, name: string | null) {
    setCategory(name == null ? null : { kind, name });
    setLimit(PAGE);
  }

  async function exportCsv() {
    const csv = cashflowsCsv(
      { portfolios, cashflows: [...listed].reverse() },
      (p) => portfolioName(p, t),
      (x) => categoryLabel(x.kind, x.category, t),
    );
    if (await saveTextFile(`asset-tracker-income-expenses-${today}.csv`, csv, 'csv')) toast(t.settings.exported);
  }

  const addButtons = (
    <>
      <Button icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ kind: 'income', defaultPortfolioId })}>
        {t.cashflow.addIncome}
      </Button>
      <Button variant="primary" icon={<Minus className="h-4 w-4" />} onClick={() => setForm({ kind: 'expense', defaultPortfolioId })}>
        {t.cashflow.addExpense}
      </Button>
    </>
  );

  const modals = (
    <>
      {form && <FlowForm {...form} onClose={() => setForm(null)} />}
      <ConfirmModal
        open={!!toDelete}
        message={t.cashflow.confirmDelete}
        confirmLabel={t.common.delete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (!toDelete) return;
          try {
            await removeCashFlow(toDelete.id);
          } catch (e) {
            toast(`${t.common.somethingWrong}: ${errorText(e)}`, 'error');
          }
        }}
      />
    </>
  );

  if (!flows.length) {
    return (
      <>
        <PageHeader title={t.cashflow.title}>{addButtons}</PageHeader>
        <Card>
          <EmptyState icon={<Receipt className="h-10 w-10" />} title={t.cashflow.emptyTitle} body={t.cashflow.emptyBody} action={<div className="flex gap-2">{addButtons}</div>} />
        </Card>
        {modals}
      </>
    );
  }

  const savings = summary.savingsRate;
  return (
    <>
      <PageHeader title={t.cashflow.title}>
        <PortfolioFilter />
        <PrivacyToggle />
        {addButtons}
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <PeriodSelect
          value={period}
          flows={inPortfolio}
          onChange={(p) => {
            setPeriod(p);
            setLimit(PAGE);
          }}
        />
        <span className="text-sm text-muted">{t.cashflow.entries(inPeriod.length)}</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Tile label={t.cashflow.incomeTotal} footer={perMonth(summary.incomeUsd, summary.incomeSyp)}>
          <Dual usd={summary.incomeUsd} syp={summary.incomeSyp} size="lg" />
        </Tile>
        <Tile label={t.cashflow.expenseTotal} footer={perMonth(summary.expenseUsd, summary.expenseSyp)}>
          <Dual usd={summary.expenseUsd} syp={summary.expenseSyp} size="lg" />
        </Tile>
        <Tile
          label={t.cashflow.net}
          footer={
            savings == null || f.privacy
              ? undefined
              : savings >= 0
                ? t.cashflow.kept(fmtPct(savings, f.lang, false))
                : t.cashflow.overspent(fmtPct(-savings, f.lang, false))
          }
        >
          <Pnl usd={summary.netUsd} syp={summary.netSyp} pctUsd={null} pctSyp={null} size="lg" />
        </Tile>
      </div>
      {sypMissing && <p className="mt-2 text-xs text-warn">{t.cashflow.noSypRate}</p>}

      <Card title={t.cashflow.chartTitle} className="mt-4">
        <CashflowChart points={series} currency={chartCurrency} />
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Breakdown
          title={t.cashflow.whereWent}
          kind="expense"
          slices={expenseSlices}
          selected={category?.kind === 'expense' ? category.name : null}
          onSelect={(c) => selectCategory('expense', c)}
        />
        <Breakdown
          title={t.cashflow.whereFrom}
          kind="income"
          slices={incomeSlices}
          selected={category?.kind === 'income' ? category.name : null}
          onSelect={(c) => selectCategory('income', c)}
        />
      </div>

      <Card
        title={t.cashflow.list}
        className="mt-4"
        bodyClassName="p-0 pt-3"
        actions={
          <>
            <Segmented
              size="sm"
              value={kindFilter}
              onChange={(v) => {
                setKindFilter(v);
                setLimit(PAGE);
              }}
              options={[
                { value: 'all', label: t.cashflow.all },
                { value: 'income', label: t.cashflow.incomeTotal },
                { value: 'expense', label: t.cashflow.expenseTotal },
              ]}
            />
            <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} disabled={!listed.length} onClick={() => void exportCsv().catch((e) => toast(errorText(e), 'error'))}>
              {t.cashflow.exportCsv}
            </Button>
          </>
        }
      >
        {category && (
          <div className="px-5 pb-3">
            <button
              type="button"
              onClick={() => selectCategory(category.kind, null)}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent-ink hover:bg-accent/25"
              title={t.cashflow.clearCategory}
            >
              {categoryLabel(category.kind, category.name, t)}
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
        {listed.length === 0 ? (
          <p className="px-5 pb-8 pt-4 text-center text-sm text-muted">{t.cashflow.emptyPeriod}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="pb-2 pe-3 ps-5 text-start font-medium">{t.cashflow.colDate}</th>
                  <th className="px-3 pb-2 text-start font-medium">{t.cashflow.colCategory}</th>
                  <th className="px-3 pb-2 text-start font-medium">{t.cashflow.colNote}</th>
                  {portfolios.length > 1 && <th className="px-3 pb-2 text-start font-medium">{t.cashflow.colPortfolio}</th>}
                  <th className="px-3 pb-2 text-end font-medium">{t.cashflow.colAmount}</th>
                  <th className="pb-2 pe-4" />
                </tr>
              </thead>
              <tbody>
                {listed.slice(0, limit).map((x) => (
                  <FlowRow
                    key={x.id}
                    x={x}
                    showPortfolio={portfolios.length > 1}
                    onEdit={() => setForm({ flow: x })}
                    onCopy={() => setForm({ copyOf: x })}
                    onDelete={() => setToDelete(x)}
                  />
                ))}
              </tbody>
            </table>
            {listed.length > limit && (
              <div className="border-t border-line px-5 py-3 text-center">
                <Button size="sm" variant="ghost" onClick={() => setLimit((n) => n + PAGE)}>
                  {t.cashflow.showMore(Math.min(PAGE, listed.length - limit))}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
      {modals}
    </>
  );
}
