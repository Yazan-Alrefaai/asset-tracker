import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useT } from '../i18n';
import type { MonthPoint } from '../lib/cashflow';
import { fmtMonth, intlLocale } from '../lib/format';
import { useFmt } from './Money';

/** Income and expenses keep the first two categorical slots everywhere (validated pair, light and dark). */
export const INCOME_COLOR = 'var(--s1)';
export const EXPENSE_COLOR = 'var(--s2)';

interface Row {
  month: string;
  income: number;
  expense: number;
}

interface TipProps {
  active?: boolean;
  payload?: { payload: Row }[];
  currency: string;
}

function Swatch({ color }: { color: string }) {
  return <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} aria-hidden />;
}

function Tip({ active, payload, currency }: TipProps) {
  const t = useT();
  const f = useFmt();
  if (!active || !payload?.length) return null;
  const r = payload[0].payload;
  const net = r.income - r.expense;
  return (
    <div className="min-w-[180px] rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <div className="mb-1 text-muted">{fmtMonth(r.month, f.lang)}</div>
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-ink-2">
          <Swatch color={INCOME_COLOR} />
          {t.cashflow.incomeTotal}
        </span>
        <span className="tnum font-semibold text-ink">{f.money(r.income, currency)}</span>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-4">
        <span className="flex items-center gap-1.5 text-ink-2">
          <Swatch color={EXPENSE_COLOR} />
          {t.cashflow.expenseTotal}
        </span>
        <span className="tnum font-semibold text-ink">{f.money(r.expense, currency)}</span>
      </div>
      <div className="mt-1 flex items-center justify-between gap-4 border-t border-line pt-1">
        <span className="text-ink-2">{t.cashflow.net}</span>
        <span className="tnum font-semibold text-ink">{f.money(net, currency, { sign: true })}</span>
      </div>
    </div>
  );
}

/** Income vs expenses per month: two series, so a legend; one shared y-axis; hover for exact values. */
export function CashflowChart({ points, currency }: { points: MonthPoint[]; currency: 'USD' | 'SYP' }) {
  const t = useT();
  const f = useFmt();
  const rows: Row[] = points.map((p) => ({
    month: p.month,
    income: currency === 'SYP' ? (p.incomeSyp ?? 0) : p.incomeUsd,
    expense: currency === 'SYP' ? (p.expenseSyp ?? 0) : p.expenseUsd,
  }));
  if (!rows.some((r) => r.income > 0 || r.expense > 0)) {
    return <p className="py-10 text-center text-sm text-muted">{t.cashflow.chartEmpty}</p>;
  }
  const compact = new Intl.NumberFormat(intlLocale(f.lang), { notation: 'compact', maximumFractionDigits: 1 });
  return (
    <div>
      <ul className="mb-3 flex flex-wrap items-center gap-4 text-xs text-ink-2">
        <li className="flex items-center gap-1.5">
          <Swatch color={INCOME_COLOR} />
          {t.cashflow.incomeTotal}
        </li>
        <li className="flex items-center gap-1.5">
          <Swatch color={EXPENSE_COLOR} />
          {t.cashflow.expenseTotal}
        </li>
        <li className="text-muted">({currency})</li>
      </ul>
      <div dir="ltr" className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 12, bottom: 0, left: 4 }} barGap={2} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
            <XAxis
              dataKey="month"
              tickFormatter={(m: string) => fmtMonth(m, f.lang, 'short')}
              tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--chart-grid)' }}
              interval="preserveStartEnd"
              minTickGap={8}
            />
            <YAxis
              tickFormatter={(v: number) => (f.privacy ? '•••' : compact.format(v))}
              tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
              tickLine={false}
              axisLine={false}
              width={56}
            />
            <Tooltip content={<Tip currency={currency} />} cursor={{ fill: 'var(--chart-grid)', fillOpacity: 0.5 }} />
            <Bar dataKey="income" name={t.cashflow.incomeTotal} fill={INCOME_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            <Bar dataKey="expense" name={t.cashflow.expenseTotal} fill={EXPENSE_COLOR} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
