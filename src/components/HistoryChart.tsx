import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useT } from '../i18n';
import { fmtShortDate, intlLocale } from '../lib/format';
import { useFmt } from './Money';

export interface HistoryPoint {
  date: string;
  value: number;
}

interface TipProps {
  active?: boolean;
  payload?: { payload: HistoryPoint }[];
  currency: string;
}

function Tip({ active, payload, currency }: TipProps) {
  const f = useFmt();
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <div className="text-muted">{f.date(p.date)}</div>
      <div className="tnum mt-0.5 text-sm font-semibold text-ink">{f.money(p.value, currency)}</div>
    </div>
  );
}

/** Single series → no legend box; the card title names it. 2px line, 10% area wash, hairline grid. */
export function HistoryChart({ points, currency }: { points: HistoryPoint[]; currency: string }) {
  const t = useT();
  const f = useFmt();
  if (points.length < 2) return <p className="py-10 text-center text-sm text-muted">{t.dashboard.historyEmpty}</p>;
  const compact = new Intl.NumberFormat(intlLocale(f.lang), { notation: 'compact', maximumFractionDigits: 1 });
  return (
    <div dir="ltr" className="h-60">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeWidth={1} />
          <XAxis
            dataKey="date"
            tickFormatter={(d: string) => fmtShortDate(d, f.lang)}
            tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
            tickLine={false}
            axisLine={{ stroke: 'var(--chart-grid)' }}
            minTickGap={28}
          />
          <YAxis
            tickFormatter={(v: number) => (f.privacy ? '•••' : compact.format(v))}
            tick={{ fontSize: 11, fill: 'var(--chart-axis)' }}
            tickLine={false}
            axisLine={false}
            width={56}
            domain={['auto', 'auto']}
          />
          <Tooltip content={<Tip currency={currency} />} cursor={{ stroke: 'var(--chart-axis)', strokeWidth: 1 }} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--s1)"
            strokeWidth={2}
            fill="var(--s1)"
            fillOpacity={0.1}
            dot={false}
            activeDot={{ r: 5, strokeWidth: 2, stroke: 'rgb(var(--surface))', fill: 'var(--s1)' }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
