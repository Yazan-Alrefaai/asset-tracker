import { useT } from '../i18n';
import { usdToSyp, type Market } from '../lib/calc/market';
import type { TypeSlice } from '../lib/calc/portfolio';
import { TYPE_COLOR_VAR } from '../lib/model';
import { TypeDot } from './AssetIcon';
import { useFmt } from './Money';

/**
 * One whole split into parts: a tall segmented bar (28px, 2px gaps, share printed inside when it fits)
 * plus a legend list that doubles as the table view.
 */
export function AllocationBar({ slices, market }: { slices: TypeSlice[]; market: Market }) {
  const t = useT();
  const f = useFmt();
  if (!slices.length) return <p className="text-sm text-muted">—</p>;
  const amount = (usd: number) =>
    f.main === 'SYP' && market.sypBuy != null ? f.money(usdToSyp(market, usd), 'SYP') : f.money(usd, 'USD');
  return (
    <div>
      <div className="flex h-7 w-full gap-[2px]" dir="ltr" role="img" aria-label={t.dashboard.allocation}>
        {slices.map((s) => {
          const label = `${t.types[s.type]}: ${amount(s.valueUsd)} (${f.pct(s.share).replace('+', '')})`;
          const showText = s.share >= 0.09;
          return (
            <div
              key={s.type}
              title={label}
              aria-label={label}
              tabIndex={0}
              className="flex h-full min-w-[3px] items-center overflow-hidden rounded px-2 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
              style={{
                width: `${s.share * 100}%`,
                backgroundColor: TYPE_COLOR_VAR[s.type],
                color: s.type === 'gold' ? '#0b0b0b' : '#ffffff',
              }}
            >
              {showText && <span className="tnum">{Math.round(s.share * 100)}%</span>}
            </div>
          );
        })}
      </div>
      <ul className="mt-4 divide-y divide-line">
        {slices.map((s) => (
          <li key={s.type} className="flex items-center gap-3 py-2 text-sm">
            <TypeDot type={s.type} />
            <span className="flex-1 text-ink">{t.types[s.type]}</span>
            <span className="tnum text-ink">{amount(s.valueUsd)}</span>
            <span className="tnum w-14 text-end text-muted">{Math.round(s.share * 1000) / 10}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
