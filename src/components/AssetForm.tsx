import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import {
  COINS,
  CURRENCIES,
  GOLD_KARATS,
  GOLD_UNITS,
  SILVER_PURITIES,
  SILVER_UNITS,
  TROY_OUNCE_GRAMS,
  coinById,
  currencyInfo,
  type MetalUnitPreset,
} from '../lib/catalog';
import { parseNum, toInput } from '../lib/format';
import type { Asset, AssetType, MetalForm, NewAsset } from '../lib/model';
import { fetchYahoo } from '../lib/prices/sources';
import { addAsset, editAsset } from '../state/actions';
import { portfolioName } from '../state/derived';
import { errorText, toast, useStore } from '../state/store';
import { AssetIcon } from './AssetIcon';
import { currencyName } from './assetText';
import { useFmt } from './Money';
import { Button, Checkbox, Field, Modal, NumberInput, Select, TextArea, TextInput } from './ui';

function presetFor(a: Asset): string {
  const presets = a.type === 'gold' ? GOLD_UNITS : SILVER_UNITS;
  if (a.unit !== 'coin') return a.unit;
  const p = presets.find((x) => x.unit === 'coin' && x.grams === a.unitGrams && x.id !== 'custom-coin');
  return p?.id ?? 'custom-coin';
}

export function AssetForm({
  open,
  onClose,
  asset,
  defaultPortfolioId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  asset?: Asset;
  defaultPortfolioId?: number;
  onCreated?: (id: number) => void;
}) {
  const t = useT();
  const f = useFmt();
  const lang = f.lang;
  const portfolios = useStore((s) => s.portfolios);
  const mainCurrency = useStore((s) => s.settings.mainCurrency);
  const editing = !!asset;

  const [step, setStep] = useState<'type' | 'details'>(editing ? 'details' : 'type');
  const [type, setType] = useState<AssetType>(asset?.type ?? 'gold');
  const [name, setName] = useState(asset?.name ?? '');
  const [nameTouched, setNameTouched] = useState(editing);
  const [portfolioId, setPortfolioId] = useState<number>(asset?.portfolioId ?? defaultPortfolioId ?? portfolios[0]?.id ?? 1);
  const [unitPreset, setUnitPreset] = useState(asset && (asset.type === 'gold' || asset.type === 'silver') ? presetFor(asset) : 'g');
  const [coinGrams, setCoinGrams] = useState(asset?.unit === 'coin' ? toInput(asset.unitGrams) : '8');
  const [karat, setKarat] = useState<number>(asset?.type === 'gold' && asset.purity ? Math.round(asset.purity * 24) : 21);
  const [silverPurity, setSilverPurity] = useState<number>(asset?.type === 'silver' && asset.purity ? asset.purity : 0.999);
  const [form, setForm] = useState<MetalForm>(asset?.form ?? 'jewelry');
  const [coinId, setCoinId] = useState(asset?.type === 'crypto' ? (coinById(asset.symbol) ? asset.symbol : 'other') : 'bitcoin');
  const [customCoin, setCustomCoin] = useState(asset?.type === 'crypto' && !coinById(asset.symbol) ? asset.symbol : '');
  const [ticker, setTicker] = useState(asset?.type === 'stock' ? asset.symbol : 'SPY');
  const [tickerInfo, setTickerInfo] = useState<{ ok: boolean; text: string; currency?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [cashCode, setCashCode] = useState(asset?.type === 'cash' ? asset.symbol : 'USD');
  const [useManual, setUseManual] = useState(asset?.useManualPrice ?? false);
  const [manualPrice, setManualPrice] = useState(toInput(asset?.manualPrice));
  const [priceCurrency, setPriceCurrency] = useState(asset?.priceCurrency ?? mainCurrency);
  const [location, setLocation] = useState(asset?.location ?? '');
  const [notes, setNotes] = useState(asset?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isMetal = type === 'gold' || type === 'silver';
  const presets: MetalUnitPreset[] = type === 'gold' ? GOLD_UNITS : SILVER_UNITS;
  const preset = presets.find((p) => p.id === unitPreset) ?? presets[0];

  // Suggested name until the user types their own.
  useEffect(() => {
    if (nameTouched) return;
    let n = '';
    if (type === 'gold') n = lang === 'ar' ? `ذهب عيار ${karat}` : `Gold ${karat}K`;
    else if (type === 'silver') n = lang === 'ar' ? 'فضة' : 'Silver';
    else if (type === 'crypto') n = coinId === 'other' ? customCoin : (coinById(coinId)?.name ?? '');
    else if (type === 'stock') n = ticker.toUpperCase();
    else if (type === 'cash') n = currencyInfo(cashCode)?.[lang] ?? cashCode;
    setName(n);
  }, [type, karat, coinId, customCoin, ticker, cashCode, lang, nameTouched]);

  // Coin presets come with their own karat.
  useEffect(() => {
    if (type === 'gold' && preset.purity && !editing) setKarat(Math.round(preset.purity * 24));
    if (preset.unit === 'coin' && form !== 'coin') setForm('coin');
  }, [unitPreset]);

  async function checkTicker() {
    if (!ticker.trim()) return;
    setChecking(true);
    try {
      const q = await fetchYahoo(ticker.trim());
      const nm = (q.extra?.name as string | null) ?? ticker.toUpperCase();
      setTickerInfo({ ok: true, text: t.assetForm.tickerFound(nm, f.price(q.price, q.currency)), currency: q.currency });
      if (!nameTouched) {
        setName(nm);
        setNameTouched(true);
      }
    } catch {
      setTickerInfo({ ok: false, text: t.assetForm.tickerNotFound });
    } finally {
      setChecking(false);
    }
  }

  function build(): NewAsset | null {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = t.common.required;
    let symbol = '';
    let unit = 'unit';
    let unitGrams: number | null = null;
    let purity: number | null = null;
    let pc: string | null = null;
    if (isMetal) {
      symbol = type === 'gold' ? 'XAU' : 'XAG';
      unit = preset.unit;
      if (preset.id === 'custom-coin') {
        const g = parseNum(coinGrams);
        if (g == null || g <= 0) e.coinGrams = t.common.mustBePositive;
        unitGrams = g;
      } else {
        unitGrams = preset.unit === 'oz' ? TROY_OUNCE_GRAMS : preset.grams;
      }
      purity = type === 'gold' ? karat / 24 : silverPurity;
    } else if (type === 'crypto') {
      symbol = coinId === 'other' ? customCoin.trim().toLowerCase() : coinId;
      if (!symbol) e.coin = t.common.required;
    } else if (type === 'stock') {
      symbol = ticker.trim().toUpperCase();
      if (!symbol) e.ticker = t.common.required;
      pc = tickerInfo?.currency ?? asset?.priceCurrency ?? null;
    } else if (type === 'cash') {
      symbol = cashCode;
    }
    let mp: number | null = null;
    if (type === 'manual' || useManual) {
      mp = parseNum(manualPrice);
      if (mp == null || mp <= 0) e.manualPrice = t.common.mustBePositive;
      pc = priceCurrency;
    }
    setErrors(e);
    if (Object.keys(e).length) return null;
    return {
      portfolioId,
      type,
      name: name.trim(),
      symbol,
      unit,
      unitGrams,
      purity,
      form: isMetal ? form : '',
      priceCurrency: pc,
      manualPrice: mp,
      useManualPrice: type !== 'manual' && useManual,
      location: location.trim(),
      notes: notes.trim(),
      archived: asset?.archived ?? false,
    };
  }

  async function submit() {
    const data = build();
    if (!data) return;
    setSaving(true);
    try {
      if (asset) {
        await editAsset(asset.id, data);
        onClose();
      } else {
        const id = await addAsset(data);
        onClose();
        onCreated?.(id);
      }
    } catch (e) {
      toast(`${t.common.somethingWrong}: ${errorText(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  const title = editing ? t.assetForm.titleEdit : t.assetForm.titleNew;

  if (step === 'type') {
    return (
      <Modal open={open} title={title} onClose={onClose} wide>
        <p className="mb-3 text-sm text-ink-2">{t.assetForm.chooseType}</p>
        <div className="grid grid-cols-2 gap-2.5">
          {(['gold', 'cash', 'crypto', 'stock', 'silver', 'manual'] as AssetType[]).map((ty) => (
            <button
              key={ty}
              type="button"
              onClick={() => {
                setType(ty);
                setUnitPreset('g');
                setStep('details');
              }}
              className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-3.5 text-start transition hover:border-accent/60 hover:bg-surface-2"
            >
              <AssetIcon type={ty} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{t.types[ty]}</span>
                <span className="mt-0.5 block text-xs leading-snug text-muted">{t.typeHints[ty]}</span>
              </span>
              <ChevronRight className="h-4 w-4 text-muted rtl:rotate-180" />
            </button>
          ))}
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      title={
        <span className="flex items-center gap-2.5">
          <AssetIcon type={type} size="sm" />
          {title} · {t.types[type]}
        </span>
      }
      onClose={onClose}
      wide
      footer={
        <>
          {!editing && (
            <Button variant="ghost" className="me-auto" onClick={() => setStep('type')}>
              {t.common.back}
            </Button>
          )}
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            {editing ? t.assetForm.saveChanges : t.assetForm.create}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        {/* type-specific fields */}
        {isMetal && (
          <>
            <Field label={t.assetForm.unit}>
              {(id) => (
                <Select id={id} value={unitPreset} onChange={(e) => setUnitPreset(e.target.value)}>
                  {presets.map((p) => (
                    <option key={p.id} value={p.id}>
                      {{
                        g: t.assetForm.unitG,
                        oz: t.assetForm.unitOz,
                        kg: t.assetForm.unitKg,
                        sovereign: t.assetForm.unitSovereign,
                        ottoman: t.assetForm.unitOttoman,
                        'custom-coin': t.assetForm.unitCustomCoin,
                      }[p.id] ?? p.id}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {type === 'gold' ? (
              <Field label={t.assetForm.karat}>
                {(id) => (
                  <Select id={id} value={karat} onChange={(e) => setKarat(Number(e.target.value))}>
                    {GOLD_KARATS.map((k) => (
                      <option key={k} value={k}>
                        {lang === 'ar' ? `عيار ${k}` : `${k}K`}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            ) : (
              <Field label={t.assetForm.purity}>
                {(id) => (
                  <Select id={id} value={silverPurity} onChange={(e) => setSilverPurity(Number(e.target.value))}>
                    {SILVER_PURITIES.map((p) => (
                      <option key={p} value={p}>
                        {Math.round(p * 1000)}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
            {preset.id === 'custom-coin' && (
              <Field label={t.assetForm.coinGrams} error={errors.coinGrams}>
                {(id) => <NumberInput id={id} value={coinGrams} onChange={(e) => setCoinGrams(e.target.value)} />}
              </Field>
            )}
            <Field label={t.assetForm.form} className={preset.id === 'custom-coin' ? '' : 'col-span-2'}>
              {(id) => (
                <Select id={id} value={form} onChange={(e) => setForm(e.target.value as MetalForm)}>
                  <option value="jewelry">{t.assetForm.formJewelry}</option>
                  <option value="bar">{t.assetForm.formBar}</option>
                  <option value="coin">{t.assetForm.formCoin}</option>
                </Select>
              )}
            </Field>
          </>
        )}

        {type === 'crypto' && (
          <>
            <Field label={t.assetForm.coin} error={errors.coin}>
              {(id) => (
                <Select id={id} value={coinId} onChange={(e) => setCoinId(e.target.value)}>
                  {COINS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.symbol} · {c.name}
                    </option>
                  ))}
                  <option value="other">{t.assetForm.otherCoin}</option>
                </Select>
              )}
            </Field>
            {coinId === 'other' ? (
              <Field label={t.assetForm.coinId} hint={t.assetForm.coinIdHelp}>
                {(id) => <TextInput id={id} dir="ltr" value={customCoin} onChange={(e) => setCustomCoin(e.target.value)} placeholder="bitcoin" />}
              </Field>
            ) : (
              <div />
            )}
          </>
        )}

        {type === 'stock' && (
          <Field
            className="col-span-2"
            label={t.assetForm.ticker}
            error={errors.ticker}
            hint={
              tickerInfo ? (
                <span className={tickerInfo.ok ? 'text-pos' : 'text-neg'}>{tickerInfo.text}</span>
              ) : (
                t.assetForm.tickerHelp
              )
            }
          >
            {(id) => (
              <div className="flex gap-2">
                <TextInput
                  id={id}
                  dir="ltr"
                  value={ticker}
                  onChange={(e) => {
                    setTicker(e.target.value.toUpperCase());
                    setTickerInfo(null);
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && checkTicker()}
                  className="uppercase"
                />
                <Button onClick={checkTicker} loading={checking}>
                  {checking ? t.assetForm.checking : t.assetForm.check}
                </Button>
              </div>
            )}
          </Field>
        )}

        {type === 'cash' && (
          <Field label={t.assetForm.currency} className="col-span-2">
            {(id) => (
              <Select id={id} value={cashCode} onChange={(e) => setCashCode(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {currencyName(c.code, lang)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        <Field label={t.assetForm.name} error={errors.name} className="col-span-2">
          {(id) => (
            <TextInput
              id={id}
              value={name}
              placeholder={t.assetForm.namePlaceholder}
              onChange={(e) => {
                setName(e.target.value);
                setNameTouched(true);
              }}
            />
          )}
        </Field>

        <Field label={t.assetForm.portfolio}>
          {(id) => (
            <Select id={id} value={portfolioId} onChange={(e) => setPortfolioId(Number(e.target.value))}>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {portfolioName(p, t)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t.assetForm.location} optional>
          {(id) => <TextInput id={id} value={location} onChange={(e) => setLocation(e.target.value)} placeholder={t.assetForm.locationPlaceholder} />}
        </Field>

        {/* own price */}
        {type !== 'manual' && type !== 'cash' && (
          <div className="col-span-2">
            <Checkbox checked={useManual} onChange={setUseManual} label={t.assetForm.useManualPrice} />
          </div>
        )}
        {(type === 'manual' || useManual) && (
          <>
            <Field label={t.assetForm.manualValue} error={errors.manualPrice}>
              {(id) => <NumberInput id={id} value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} />}
            </Field>
            <Field label={t.assetForm.valueCurrency}>
              {(id) => (
                <Select id={id} value={priceCurrency} onChange={(e) => setPriceCurrency(e.target.value)}>
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {currencyName(c.code, lang)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </>
        )}

        <Field label={t.assetForm.notes} optional className="col-span-2">
          {(id) => <TextArea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  );
}
