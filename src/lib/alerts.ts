import type { Messages } from '../i18n/en';
import { coinById } from './catalog';
import { type Market, splitKey } from './calc/market';
import { fmtMoney, fmtNum } from './format';
import type { Alert } from './model';
import type { Language } from './settings';

/** Totals used by "total value" alerts. */
export interface Totals {
  usd: number | null;
  syp: number | null;
}

/** Current value of what an alert watches, or null when it is not known yet. */
export function alertValue(target: string, m: Market, totals: Totals): number | null {
  const [kind, id] = splitKey(target);
  switch (kind) {
    case 'metal':
      return id === 'XAU' ? m.xau : id === 'XAG' ? m.xag : null;
    case 'sygold':
      return m.localGold[id]?.buy ?? null;
    case 'syp':
      // Alerts watch the market rate even when the user values things with a manual rate.
      return m.sypPer[id]?.buy ?? (id === 'USD' ? m.sypBuy : null);
    case 'crypto':
      return m.crypto[id] ?? null;
    case 'stock':
      return m.stocks[id.toUpperCase()]?.price ?? null;
    case 'total':
      return id === 'SYP' ? totals.syp : totals.usd;
    default:
      return null;
  }
}

/** Currency the target's value is expressed in. */
export function alertCurrency(target: string, m: Market): string {
  const [kind, id] = splitKey(target);
  switch (kind) {
    case 'sygold':
    case 'syp':
      return 'SYP';
    case 'stock':
      return m.stocks[id.toUpperCase()]?.currency ?? 'USD';
    case 'total':
      return id === 'SYP' ? 'SYP' : 'USD';
    default:
      return 'USD';
  }
}

export function alertTargetLabel(target: string, t: Messages): string {
  const [kind, id] = splitKey(target);
  switch (kind) {
    case 'metal':
      return id === 'XAG' ? t.alerts.targets.silverOz : t.alerts.targets.goldOz;
    case 'sygold':
      return t.alerts.targets.goldKarat(id);
    case 'syp':
      return t.alerts.targets.currencySyp(id);
    case 'crypto': {
      const c = coinById(id);
      return c ? `${c.name} (${c.symbol})` : id;
    }
    case 'stock':
      return id.toUpperCase();
    case 'total':
      return id === 'SYP' ? t.alerts.targets.totalSyp : t.alerts.targets.totalUsd;
    default:
      return target;
  }
}

export function fmtAlertValue(v: number | null, currency: string, target: string, lang: Language): string {
  // Exchange rates read better as plain numbers with 2 decimals: "152.50".
  if (target.startsWith('syp:')) return fmtNum(v, lang, 2, 2);
  return fmtMoney(v, currency, lang);
}

/** A sensible starting line: 2% above (or below) today's value, rounded to a tidy step. */
export function suggestAlertValue(current: number | null, condition: 'above' | 'below'): number | null {
  if (current == null || !(current > 0)) return null;
  const v = current * (condition === 'above' ? 1.02 : 0.98);
  const step = v >= 10_000 ? 50 : v >= 1_000 ? 10 : v >= 100 ? 0.5 : v >= 1 ? 0.01 : 0.0001;
  return Number((Math.round(v / step) * step).toFixed(4));
}

/** How far a price must move back before a repeating alert can fire again (stops spam around the line). */
export const REARM_MARGIN = 0.005;

export interface AlertCheck {
  fired: { alert: Alert; value: number }[];
  /** Alerts whose stored state must be saved. */
  changed: Alert[];
}

export function evaluateAlerts(
  alerts: Alert[],
  valueOf: (target: string) => number | null,
  now: string = new Date().toISOString(),
): AlertCheck {
  const fired: AlertCheck['fired'] = [];
  const changed: Alert[] = [];
  for (const a of alerts) {
    if (!a.active) continue;
    const v = valueOf(a.target);
    if (v == null || !Number.isFinite(v)) continue;
    const met = a.condition === 'above' ? v >= a.value : v <= a.value;
    if (a.state === 'armed' && met) {
      const next: Alert = { ...a, state: 'fired', lastTriggeredAt: now, lastValue: v, active: a.repeat };
      fired.push({ alert: next, value: v });
      changed.push(next);
    } else if (a.state === 'fired') {
      const backAcross = a.condition === 'above' ? v < a.value * (1 - REARM_MARGIN) : v > a.value * (1 + REARM_MARGIN);
      if (backAcross) changed.push({ ...a, state: 'armed' });
    }
  }
  return { fired, changed };
}

export function alertMessage(a: Alert, value: number, m: Market, t: Messages, lang: Language): { title: string; body: string } {
  const cur = alertCurrency(a.target, m);
  const what = alertTargetLabel(a.target, t);
  const line = fmtAlertValue(a.value, cur, a.target, lang);
  const now = fmtAlertValue(value, cur, a.target, lang);
  const title = a.condition === 'above' ? t.alerts.firedAbove(what, line) : t.alerts.firedBelow(what, line);
  const body = [t.alerts.nowAt(now), a.note].filter(Boolean).join(' · ');
  return { title, body };
}

export interface TargetOption {
  target: string;
  label: string;
  group: 'metals' | 'syp' | 'crypto' | 'stocks' | 'total';
}

/** Everything an alert can watch, given the current prices and holdings. */
export function alertTargets(m: Market, held: { crypto: string[]; stocks: string[] }, t: Messages): TargetOption[] {
  const out: TargetOption[] = [
    { target: 'metal:XAU', label: alertTargetLabel('metal:XAU', t), group: 'metals' },
    { target: 'metal:XAG', label: alertTargetLabel('metal:XAG', t), group: 'metals' },
  ];
  for (const k of ['24K', '22K', '21K', '18K']) {
    if (m.localGold[k]) out.push({ target: `sygold:${k}`, label: alertTargetLabel(`sygold:${k}`, t), group: 'metals' });
  }
  for (const code of ['USD', 'EUR', 'TRY', 'SAR', 'AED']) {
    if (m.sypPer[code] || (code === 'USD' && m.sypBuy != null)) {
      out.push({ target: `syp:${code}`, label: alertTargetLabel(`syp:${code}`, t), group: 'syp' });
    }
  }
  for (const id of [...new Set(['bitcoin', 'ethereum', ...held.crypto])]) {
    out.push({ target: `crypto:${id}`, label: alertTargetLabel(`crypto:${id}`, t), group: 'crypto' });
  }
  for (const tk of [...new Set(['SPY', ...held.stocks.map((s) => s.toUpperCase())])]) {
    out.push({ target: `stock:${tk}`, label: alertTargetLabel(`stock:${tk}`, t), group: 'stocks' });
  }
  out.push({ target: 'total:USD', label: alertTargetLabel('total:USD', t), group: 'total' });
  out.push({ target: 'total:SYP', label: alertTargetLabel('total:SYP', t), group: 'total' });
  return out;
}
