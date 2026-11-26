import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { useMemo } from 'react';
import { useT } from '../i18n';
import { fmtAgo, fmtDate, fmtMoney, fmtNum, fmtPct, qtyDecimals, type MoneyOpts } from '../lib/format';
import type { AssetType } from '../lib/model';
import { useStore } from '../state/store';
import { cx } from './ui';

const MASK = '•••••';

/** Formatting helpers bound to the current language and the "hide numbers" switch. */
export function useFmt() {
  const lang = useStore((s) => s.settings.language);
  const privacy = useStore((s) => s.privacy);
  const showOld = useStore((s) => s.settings.showOldSyp);
  const main = useStore((s) => s.settings.mainCurrency);
  return useMemo(
    () => ({
      lang,
      privacy,
      showOld,
      main,
      /** Private amounts (hidden by the privacy switch). */
      money: (v: number | null | undefined, cur: string, o?: MoneyOpts) => (privacy ? MASK : fmtMoney(v, cur, lang, o)),
      qty: (v: number | null | undefined, type: AssetType) => (privacy ? MASK : fmtNum(v, lang, qtyDecimals(type))),
      /** Public prices and rates (never hidden). */
      price: (v: number | null | undefined, cur: string, o?: MoneyOpts) => fmtMoney(v, cur, lang, o),
      num: (v: number | null | undefined, max = 2, min = 0) => fmtNum(v, lang, max, min),
      pct: (v: number | null | undefined) => fmtPct(v, lang),
      ago: (iso: string | null | undefined) => fmtAgo(iso, lang),
      date: (d: string) => fmtDate(d, lang),
    }),
    [lang, privacy, showOld, main],
  );
}

/** A value shown in the main currency (big) and the other currency (small). */
export function Dual({
  usd,
  syp,
  size = 'md',
  className,
}: {
  usd: number | null;
  syp: number | null;
  size?: 'hero' | 'lg' | 'md' | 'sm';
  className?: string;
}) {
  const f = useFmt();
  const t = useT();
  const sypFirst = (f.main === 'SYP' && syp != null) || usd == null;
  const big = sypFirst ? f.money(syp, 'SYP') : f.money(usd, 'USD');
  const small = sypFirst ? (usd != null ? f.money(usd, 'USD') : null) : syp != null ? f.money(syp, 'SYP') : null;
  const old = f.showOld && syp != null && !f.privacy ? t.common.old(f.num(syp * 100, 0)) : null;
  const bigCls = {
    hero: 'text-[44px] leading-[1.05] font-semibold tracking-tight',
    lg: 'text-2xl font-semibold',
    md: 'text-[15px] font-medium',
    sm: 'text-sm',
  }[size];
  const smallCls = size === 'hero' || size === 'lg' ? 'text-sm' : 'text-xs';
  return (
    <div className={className}>
      <div className={cx(bigCls, 'text-ink', size !== 'hero' && size !== 'lg' && 'tnum')}>{big}</div>
      {(small || old) && (
        <div className={cx(smallCls, 'tnum mt-0.5 text-muted')}>
          {small}
          {small && old && ' · '}
          {old}
        </div>
      )}
    </div>
  );
}

/** Profit/loss with sign, arrow and colour (never colour alone). */
export function Pnl({
  usd,
  syp,
  pctUsd,
  pctSyp,
  size = 'md',
  showSecondary = true,
}: {
  usd: number | null;
  syp: number | null;
  pctUsd: number | null;
  pctSyp: number | null;
  size?: 'lg' | 'md' | 'sm';
  showSecondary?: boolean;
}) {
  const f = useFmt();
  const sypFirst = (f.main === 'SYP' && syp != null) || usd == null;
  const v = sypFirst ? syp : usd;
  const pct = sypFirst ? pctSyp : pctUsd;
  const other = sypFirst ? usd : syp;
  const otherPct = sypFirst ? pctUsd : pctSyp;
  if (v == null) return <span className="text-muted">—</span>;
  const up = v > 0;
  const down = v < 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <div>
      <div
        className={cx(
          'tnum inline-flex items-center gap-1',
          size === 'lg' ? 'text-2xl font-semibold' : size === 'md' ? 'text-[15px] font-medium' : 'text-sm font-medium',
          up ? 'text-pos' : down ? 'text-neg' : 'text-ink-2',
        )}
      >
        {(up || down) && <Icon className={size === 'lg' ? 'h-5 w-5' : 'h-4 w-4'} aria-hidden />}
        <span>{f.money(v, sypFirst ? 'SYP' : 'USD', { sign: true })}</span>
        {pct != null && <span className={size === 'lg' ? 'text-base font-medium' : 'text-xs'}>({f.pct(pct)})</span>}
      </div>
      {showSecondary && other != null && (
        <div className="tnum mt-0.5 text-xs text-muted">
          {f.money(other, sypFirst ? 'USD' : 'SYP', { sign: true })}
          {otherPct != null && ` (${f.pct(otherPct)})`}
        </div>
      )}
    </div>
  );
}

export function useAgo() {
  const lang = useStore((s) => s.settings.language);
  return (iso: string | null | undefined) => fmtAgo(iso, lang);
}
