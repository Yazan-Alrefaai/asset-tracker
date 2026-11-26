import { CircleCheck, Clock, PictureInPicture2, RefreshCw, TriangleAlert } from 'lucide-react';
import { openWidget } from '../state/widgets';
import { useState } from 'react';
import { PageHeader, useTicker } from '../components/Layout';
import { useFmt } from '../components/Money';
import { Badge, Button, Card, Checkbox, Field, NumberInput, Segmented, Select, cx } from '../components/ui';
import { useT } from '../i18n';
import { CURRENCIES, GOLD_KARATS, TROY_OUNCE_GRAMS, coinById, currencyInfo } from '../lib/catalog';
import { splitKey, usdToSyp } from '../lib/calc/market';
import { spotPerGram } from '../lib/calc/valuation';
import { parseNum, toInput } from '../lib/format';
import { saveSettings } from '../state/actions';
import { useMarket } from '../state/derived';
import { refreshPrices } from '../state/prices';
import { PRICE_GROUPS, useStore } from '../state/store';

function SypCard() {
  const t = useT();
  const f = useFmt();
  const m = useMarket();
  const settings = useStore((s) => s.settings);
  const cities = useStore((s) => s.spCities);
  const q = useStore((s) => s.quotes['syp:USD']);
  const [manual, setManual] = useState(settings.sypSource === 'manual');
  const [buy, setBuy] = useState(toInput(settings.sypManualBuy ?? m.sypBuy, 2));
  const [sell, setSell] = useState(toInput(settings.sypManualSell ?? m.sypSell, 2));

  const big = (label: string, v: number | null) => (
    <div>
      <p className="text-[13px] text-ink-2">{label}</p>
      <p className="tnum mt-1 text-[40px] font-semibold leading-none text-ink" dir="ltr">
        {f.num(v, 2, 2)}
      </p>
      {v != null && <p className="tnum mt-1.5 text-xs text-muted">{t.common.old(f.num(v * 100, 0))}</p>}
    </div>
  );

  return (
    <Card
      title={t.prices.sypTitle}
      subtitle={
        m.sypSource === 'manual' ? (
          <Badge tone="accent">{t.prices.usingManual}</Badge>
        ) : q ? (
          <>
            {t.prices.source('sp-today.com')} · {t.common.updated(f.ago(q.asOf ?? q.fetchedAt))}
          </>
        ) : (
          t.common.notUpdated
        )
      }
      actions={
        cities.length > 1 && (
          <Select
            aria-label={t.prices.city}
            value={settings.sypCity}
            onChange={(e) => void saveSettings({ sypCity: e.target.value })}
            className="w-auto"
          >
            {cities.map((c) => (
              <option key={c.slug} value={c.slug}>
                {f.lang === 'ar' ? c.ar : c.en}
              </option>
            ))}
          </Select>
        )
      }
    >
      <div className="flex flex-wrap gap-12">
        {big(t.prices.buy, m.sypBuy)}
        {big(t.prices.sell, m.sypSell)}
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <Checkbox
          checked={manual}
          onChange={(v) => {
            setManual(v);
            if (!v) void saveSettings({ sypSource: 'sptoday' });
          }}
          label={t.prices.manualRate}
        />
        {manual && (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <Field label={t.prices.manualBuy}>{(id) => <NumberInput id={id} value={buy} onChange={(e) => setBuy(e.target.value)} className="w-40" />}</Field>
            <Field label={t.prices.manualSell}>{(id) => <NumberInput id={id} value={sell} onChange={(e) => setSell(e.target.value)} className="w-40" />}</Field>
            <Button
              variant="primary"
              onClick={() => {
                const b = parseNum(buy);
                const s = parseNum(sell);
                if (!b || b <= 0) return;
                void saveSettings({ sypSource: 'manual', sypManualBuy: b, sypManualSell: s && s > 0 ? s : b });
              }}
            >
              {t.prices.saveRate}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

function MetalsCard() {
  const t = useT();
  const f = useFmt();
  const m = useMarket();
  const pricing = useStore((s) => s.settings.metalPricing);
  const qx = useStore((s) => s.quotes['metal:XAU']);
  const hasLocal = Object.keys(m.localGold).length > 0;
  return (
    <Card
      title={t.prices.goldTitle}
      subtitle={qx ? `${t.prices.source(qx.source)} · ${t.common.updated(f.ago(qx.asOf ?? qx.fetchedAt))}` : t.common.notUpdated}
      actions={
        <div className="flex items-center gap-2 text-[13px] text-ink-2">
          {t.prices.goldValuation}
          <Segmented
            size="sm"
            value={pricing}
            onChange={(v) => void saveSettings({ metalPricing: v })}
            options={[
              { value: 'local', label: t.prices.goldLocal },
              { value: 'global', label: t.prices.goldWorld },
            ]}
          />
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap gap-10">
        <div>
          <p className="text-[13px] text-ink-2">
            {t.prices.world} · {t.prices.perOunce}
          </p>
          <p className="tnum mt-1 text-2xl font-semibold text-ink">{f.price(m.xau, 'USD')}</p>
          <p className="tnum text-xs text-muted">{f.price(usdToSyp(m, m.xau), 'SYP')}</p>
        </div>
        <div>
          <p className="text-[13px] text-ink-2">
            {t.prices.silverTitle} · {t.prices.perOunce}
          </p>
          <p className="tnum mt-1 text-2xl font-semibold text-ink">{f.price(m.xag, 'USD')}</p>
          <p className="tnum text-xs text-muted">
            {f.price(m.xag != null ? m.xag / TROY_OUNCE_GRAMS : null, 'USD')} / {t.units.g}
          </p>
        </div>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="pb-2 text-start font-medium">
              {t.prices.karat} · {t.prices.perGram}
            </th>
            <th className="pb-2 text-end font-medium">{t.prices.world}</th>
            <th className="pb-2 text-end font-medium">{t.prices.worldSyp}</th>
            {hasLocal && <th className="pb-2 text-end font-medium">{t.prices.market}</th>}
          </tr>
        </thead>
        <tbody>
          {GOLD_KARATS.map((k) => {
            const usd = spotPerGram(m.xau, k / 24);
            const local = m.localGold[`${k}K`];
            return (
              <tr key={k} className={cx('border-t border-line', k === 21 && 'bg-accent/5')}>
                <td className="py-2 font-medium text-ink">{f.lang === 'ar' ? `عيار ${k}` : `${k}K`}</td>
                <td className="tnum py-2 text-end text-ink-2">{f.price(usd, 'USD')}</td>
                <td className="tnum py-2 text-end text-ink-2">{f.price(usdToSyp(m, usd), 'SYP')}</td>
                {hasLocal && (
                  <td className="tnum py-2 text-end text-ink">
                    {local ? `${f.num(local.buy, 0)} / ${f.num(local.sell, 0)}` : '—'}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function CurrenciesCard() {
  const t = useT();
  const f = useFmt();
  const m = useMarket();
  const rows = CURRENCIES.filter((c) => c.code !== 'USD' && c.code !== 'SYP' && (m.fx[c.code] || m.sypPer[c.code]));
  return (
    <Card title={t.prices.currenciesTitle} bodyClassName="p-0 pt-3">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="pb-2 pe-3 ps-5 text-start font-medium" />
            <th className="px-3 pb-2 text-end font-medium">{t.prices.perUsd}</th>
            <th className="pb-2 pe-5 ps-3 text-end font-medium">{t.prices.inSyp}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.code} className="border-t border-line">
              <td className="py-2 pe-3 ps-5">
                <span className="me-2">{c.flag}</span>
                <span className="font-medium text-ink">{c.code}</span>
                <span className="ms-2 text-xs text-muted">{f.lang === 'ar' ? c.ar : c.en}</span>
              </td>
              <td className="tnum px-3 py-2 text-end text-ink-2">{m.fx[c.code] ? f.num(m.fx[c.code], 4) : '—'}</td>
              <td className="tnum py-2 pe-5 ps-3 text-end text-ink">
                {m.sypPer[c.code] ? `${f.num(m.sypPer[c.code].buy, 2, 2)} / ${f.num(m.sypPer[c.code].sell, 2, 2)}` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {m.fx.SYP && (
        <p className="px-5 py-3 text-xs text-muted">
          {currencyInfo('SYP')?.[f.lang]} · {f.lang === 'ar' ? 'السعر الرسمي/الدولي' : 'official / international rate'}: {f.num(m.fx.SYP, 2)}
        </p>
      )}
    </Card>
  );
}

function MarketsCard() {
  const t = useT();
  const f = useFmt();
  const quotes = useStore((s) => s.quotes);
  const crypto = Object.values(quotes).filter((q) => q.key.startsWith('crypto:'));
  const stocks = Object.values(quotes).filter((q) => q.key.startsWith('stock:'));
  const change = (v: unknown) =>
    typeof v === 'number' ? (
      <span className={cx('tnum text-xs', v > 0 ? 'text-pos' : v < 0 ? 'text-neg' : 'text-muted')}>{f.pct(v / 100)}</span>
    ) : null;
  return (
    <div className="grid grid-cols-2 gap-4">
      <Card title={t.prices.cryptoTitle} bodyClassName="p-0 pt-2">
        <ul>
          {crypto.map((q) => {
            const id = splitKey(q.key)[1];
            const c = coinById(id);
            return (
              <li key={q.key} className="flex items-center justify-between gap-3 border-t border-line px-5 py-2 text-sm first:border-t-0">
                <span>
                  <span className="font-medium text-ink">{c?.symbol ?? id}</span>
                  <span className="ms-2 text-xs text-muted">{c?.name}</span>
                </span>
                <span className="flex items-baseline gap-2">
                  <span className="tnum text-ink">{f.price(q.price, 'USD')}</span>
                  {change(q.extra?.change24h)}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card title={t.prices.stocksTitle} bodyClassName="p-0 pt-2">
        <ul>
          {stocks.map((q) => {
            const prev = q.extra?.prevClose as number | null | undefined;
            return (
              <li key={q.key} className="flex items-center justify-between gap-3 border-t border-line px-5 py-2 text-sm first:border-t-0">
                <span className="min-w-0">
                  <span className="font-medium text-ink">{splitKey(q.key)[1]}</span>
                  <span className="ms-2 truncate text-xs text-muted">{(q.extra?.name as string) ?? ''}</span>
                </span>
                <span className="flex shrink-0 items-baseline gap-2">
                  <span className="tnum text-ink">{f.price(q.price, q.currency)}</span>
                  {prev ? change(((q.price - prev) / prev) * 100) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function SourcesCard() {
  const t = useT();
  const f = useFmt();
  const status = useStore((s) => s.status);
  return (
    <Card
      title={t.prices.sourcesTitle}
      actions={
        <Button size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} onClick={() => refreshPrices()}>
          {t.prices.refreshAll}
        </Button>
      }
      bodyClassName="p-0 pt-3"
    >
      <ul>
        {PRICE_GROUPS.map((g) => {
          const s = status[g];
          const state = s.running ? 'running' : s.lastError ? 'error' : s.lastOk ? 'ok' : 'waiting';
          return (
            <li key={g} className="flex items-center gap-3 border-t border-line px-5 py-2.5 text-sm">
              {state === 'ok' ? (
                <CircleCheck className="h-4 w-4 text-pos" />
              ) : state === 'error' ? (
                <TriangleAlert className="h-4 w-4 text-warn" />
              ) : state === 'running' ? (
                <RefreshCw className="h-4 w-4 animate-spin text-muted" />
              ) : (
                <Clock className="h-4 w-4 text-muted" />
              )}
              <span className="flex-1 text-ink">{t.prices.groups[g]}</span>
              <span className="text-xs text-muted">
                {state === 'error'
                  ? `${t.prices.error}${s.lastOk ? ` · ${t.common.updated(f.ago(s.lastOk))}` : ''}`
                  : s.lastOk
                    ? t.common.updated(f.ago(s.lastOk))
                    : t.prices.waiting}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function PricesPage() {
  const t = useT();
  useTicker(15_000);
  return (
    <>
      <PageHeader title={t.prices.title}>
        <Button icon={<PictureInPicture2 className="h-4 w-4" />} onClick={() => void openWidget('prices')}>
          {t.widgets.popOut}
        </Button>
      </PageHeader>
      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-2 space-y-4">
          <SypCard />
          <SourcesCard />
        </div>
        <div className="col-span-3 space-y-4">
          <MetalsCard />
          <CurrenciesCard />
        </div>
      </div>
      <div className="mt-4">
        <MarketsCard />
      </div>
      <p className="mt-6 text-xs text-muted">{t.prices.disclaimer}</p>
    </>
  );
}
