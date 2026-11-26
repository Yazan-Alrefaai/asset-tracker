import { HandCoins, Info } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AssetIcon } from '../components/AssetIcon';
import { assetDetails } from '../components/assetText';
import { PageHeader, PrivacyToggle } from '../components/Layout';
import { Dual, useFmt } from '../components/Money';
import { Badge, Card, Checkbox, Field, NumberInput, Segmented, Select, cx } from '../components/ui';
import { useT } from '../i18n';
import { CURRENCIES } from '../lib/catalog';
import { parseNum, toInput } from '../lib/format';
import { computeZakat, defaultIncluded } from '../lib/zakat';
import { saveSettings } from '../state/actions';
import { portfolioName, useHoldings, useMarket } from '../state/derived';
import { useStore } from '../state/store';

export function ZakatPage() {
  const t = useT();
  const f = useFmt();
  const m = useMarket();
  const s = useStore((st) => st.settings);
  const portfolios = useStore((st) => st.portfolios);
  const all = useHoldings('all');
  const [debtsStr, setDebtsStr] = useState(s.zakatDebts ? toInput(s.zakatDebts) : '');

  useEffect(() => {
    setDebtsStr(s.zakatDebts ? toInput(s.zakatDebts) : '');
  }, [s.zakatDebts]);

  const included = s.zakatPortfolios;
  const holdings = useMemo(
    () => all.filter((h) => included == null || included.includes(h.asset.portfolioId)).filter((h) => h.quantity > 0),
    [all, included],
  );
  const z = useMemo(
    () =>
      computeZakat(holdings, m, {
        basis: s.zakatBasis,
        includeJewelry: s.zakatIncludeJewelry,
        overrides: s.zakatOverrides,
        debts: s.zakatDebts,
        debtsCurrency: s.zakatDebtsCurrency,
      }),
    [holdings, m, s.zakatBasis, s.zakatIncludeJewelry, s.zakatOverrides, s.zakatDebts, s.zakatDebtsCurrency],
  );

  const togglePortfolio = (id: number, on: boolean) => {
    const current = included ?? portfolios.map((p) => p.id);
    const next = on ? [...new Set([...current, id])] : current.filter((x) => x !== id);
    void saveSettings({ zakatPortfolios: next.length === portfolios.length ? null : next });
  };

  const toggleAsset = (assetId: number, on: boolean, defaultOn: boolean) => {
    const next = { ...s.zakatOverrides };
    if (on === defaultOn) delete next[String(assetId)];
    else next[String(assetId)] = on;
    void saveSettings({ zakatOverrides: next });
  };

  const due = z.reachesNisab === true;
  const nisabSyp = s.zakatBasis === 'gold' ? z.nisab.gold.syp : z.nisab.silver.syp;

  return (
    <>
      <PageHeader title={t.zakat.title}>
        <PrivacyToggle />
      </PageHeader>
      <p className="-mt-3 mb-5 max-w-3xl text-sm text-ink-2">{t.zakat.intro}</p>

      <div className="grid grid-cols-5 gap-4">
        <div className="col-span-3 space-y-4">
          <div className={cx('rounded-xl border p-6 shadow-card', due ? 'border-accent/50 bg-accent/10' : 'border-line bg-surface')}>
            <div className="flex items-center gap-2 text-[13px] text-ink-2">
              <HandCoins className="h-4 w-4" />
              {due ? t.zakat.due : t.zakat.notDue}
            </div>
            {due ? (
              <>
                <Dual usd={z.dueUsd} syp={z.dueSyp} size="hero" className="mt-2" />
                {(z.goldGramsDue > 0 || z.silverGramsDue > 0) && (
                  <p className="mt-3 text-sm text-ink-2">
                    {[
                      z.goldGramsDue > 0 ? t.zakat.inKind(f.num(z.goldGramsDue, 2), t.types.gold) : '',
                      z.silverGramsDue > 0 ? t.zakat.inKind(f.num(z.silverGramsDue, 2), t.types.silver) : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2 text-base text-ink">{z.reachesNisab === null ? t.zakat.noPrices : t.zakat.belowNisab}</p>
            )}
            <dl className="mt-5 grid grid-cols-3 gap-4 border-t border-line pt-4">
              <div>
                <dt className="text-xs text-muted">{t.zakat.wealth}</dt>
                <dd className="mt-1">
                  <Dual usd={z.totalUsd} syp={z.totalSyp} size="sm" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t.zakat.afterDebts}</dt>
                <dd className="mt-1">
                  <Dual usd={z.netUsd} syp={z.netSyp} size="sm" />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{s.zakatBasis === 'gold' ? t.zakat.nisabGold : t.zakat.nisabSilver}</dt>
                <dd className="mt-1">
                  <div className="tnum text-sm text-ink">{f.price(z.nisabUsd, 'USD')}</div>
                  <div className="tnum text-xs text-muted">{f.price(nisabSyp, 'SYP')}</div>
                </dd>
              </div>
            </dl>
          </div>

          <Card title={t.zakat.counted} bodyClassName="p-0 pt-2">
            <ul>
              {z.rows.map((r) => {
                const a = r.holding.asset;
                const defaultOn = defaultIncluded(a, s.zakatIncludeJewelry);
                const canToggle = r.reason !== 'empty';
                return (
                  <li key={a.id} className="flex items-center gap-3 border-t border-line px-5 py-2.5 first:border-t-0">
                    <input
                      type="checkbox"
                      aria-label={a.name}
                      disabled={!canToggle}
                      checked={r.included}
                      onChange={(e) => toggleAsset(a.id, e.target.checked, defaultOn)}
                      className="h-4 w-4 cursor-pointer accent-[rgb(var(--accent))]"
                    />
                    <AssetIcon type={a.type} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-ink">{a.name}</div>
                      <div className="truncate text-xs text-muted">{assetDetails(a, t, f.lang)}</div>
                    </div>
                    {r.reason && r.reason !== 'empty' && <Badge tone={r.reason === 'override' ? 'accent' : 'neutral'}>{t.zakat.reasons[r.reason]}</Badge>}
                    <Dual usd={r.valueUsd} syp={r.valueSyp} size="sm" className={cx('min-w-[120px] text-end', !r.included && 'opacity-50')} />
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>

        <div className="col-span-2 space-y-4">
          <Card title={t.zakat.settings}>
            <div className="space-y-5">
              <Field label={t.zakat.basis}>
                {() => (
                  <Segmented
                    value={s.zakatBasis}
                    onChange={(v) => void saveSettings({ zakatBasis: v })}
                    options={[
                      { value: 'gold', label: t.zakat.basisGold },
                      { value: 'silver', label: t.zakat.basisSilver },
                    ]}
                  />
                )}
              </Field>
              <div className="text-xs text-muted">
                <div>
                  {t.zakat.nisabGold}: <span className="tnum">{f.price(z.nisab.gold.usd, 'USD')}</span> ·{' '}
                  <span className="tnum">{f.price(z.nisab.gold.syp, 'SYP')}</span>
                </div>
                <div>
                  {t.zakat.nisabSilver}: <span className="tnum">{f.price(z.nisab.silver.usd, 'USD')}</span> ·{' '}
                  <span className="tnum">{f.price(z.nisab.silver.syp, 'SYP')}</span>
                </div>
              </div>
              <div>
                <Checkbox checked={s.zakatIncludeJewelry} onChange={(v) => void saveSettings({ zakatIncludeJewelry: v })} label={t.zakat.includeJewelry} />
                <p className="mt-1 ps-6 text-xs text-muted">{t.zakat.jewelryHelp}</p>
              </div>
              {portfolios.length > 1 && (
                <Field label={t.zakat.portfolios}>
                  {() => (
                    <div className="flex flex-col gap-2">
                      {portfolios.map((p) => (
                        <Checkbox
                          key={p.id}
                          checked={included == null || included.includes(p.id)}
                          onChange={(v) => togglePortfolio(p.id, v)}
                          label={portfolioName(p, t)}
                        />
                      ))}
                    </div>
                  )}
                </Field>
              )}
              <Field label={t.zakat.debts} hint={t.zakat.debtsHelp}>
                {(id) => (
                  <div className="flex gap-2">
                    <NumberInput
                      id={id}
                      value={debtsStr}
                      placeholder="0"
                      onChange={(e) => setDebtsStr(e.target.value)}
                      onBlur={() => void saveSettings({ zakatDebts: Math.max(0, parseNum(debtsStr) ?? 0) })}
                    />
                    <Select
                      aria-label={t.assetForm.currency}
                      value={s.zakatDebtsCurrency}
                      onChange={(e) => void saveSettings({ zakatDebtsCurrency: e.target.value })}
                      className="w-28"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </Field>
            </div>
          </Card>
          <div className="flex gap-2 rounded-xl border border-line bg-surface-2 p-4 text-xs leading-relaxed text-ink-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            <div className="space-y-2">
              <p>{t.zakat.hawl}</p>
              <p>{t.zakat.disclaimer}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
