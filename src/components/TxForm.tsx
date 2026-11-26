import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import { CURRENCIES, SYP_OLD, SYP_REDENOMINATION } from '../lib/catalog';
import { todayLocal } from '../lib/dates';
import { parseNum, toInput } from '../lib/format';
import { unitsPerUsdNow } from '../lib/calc/market';
import type { Asset, NewTx, Tx, TxKind } from '../lib/model';
import { fetchHistoricalUsdRate } from '../lib/prices/sources';
import { addTx, editTx } from '../state/actions';
import { useMarket } from '../state/derived';
import { errorText, toast, useStore } from '../state/store';
import { currencyName, unitLabel } from './assetText';
import { useFmt } from './Money';
import { Button, Field, Modal, NumberInput, Segmented, Select, TextArea, TextInput } from './ui';

const ECB_CODES = new Set(['EUR', 'GBP', 'TRY', 'CHF', 'CAD', 'AUD', 'SEK', 'NOK', 'DKK', 'CNY', 'JPY']);

function defaultCurrency(a: Asset, main: 'USD' | 'SYP'): string {
  if (a.type === 'cash') return a.symbol === 'SYP' ? 'USD' : 'SYP';
  if (a.type === 'crypto' || a.type === 'stock') return 'USD';
  if (a.type === 'manual') return a.priceCurrency ?? main;
  return main;
}

export function TxForm({
  open,
  onClose,
  asset,
  kind: initialKind = 'buy',
  tx,
  holdingQty = 0,
}: {
  open: boolean;
  onClose: () => void;
  asset: Asset;
  kind?: TxKind;
  tx?: Tx;
  holdingQty?: number;
}) {
  const t = useT();
  const f = useFmt();
  const m = useMarket();
  const mainCurrency = useStore((s) => s.settings.mainCurrency);
  const unit = unitLabel(asset, t);

  const [kind, setKind] = useState<TxKind>(tx?.kind ?? initialKind);
  const [date, setDate] = useState(tx?.date ?? todayLocal());
  const [qty, setQty] = useState(toInput(tx?.quantity));
  const [mode, setMode] = useState<'unit' | 'total'>('unit');
  const [currency, setCurrency] = useState(tx?.currency ?? defaultCurrency(asset, mainCurrency));
  const [priceStr, setPriceStr] = useState(() => {
    if (tx) return toInput(tx.price);
    // Buying dollars (or other cash) with Syrian pounds: the price is today's exchange rate.
    if (asset.type === 'cash' && currency === 'SYP') {
      const r = asset.symbol === 'USD' ? m.sypSell : m.sypPer[asset.symbol]?.sell;
      return r ? toInput(r, 2) : '';
    }
    return '';
  });
  const [fees, setFees] = useState(tx?.fees ? toInput(tx.fees) : '');
  const [usdRateStr, setUsdRateStr] = useState(() =>
    tx && tx.currency !== 'USD' && tx.currency !== 'SYP' ? toInput(tx.usdRate) : toInput(unitsPerUsdNow(m, currency), 4),
  );
  const [usdRateTouched, setUsdRateTouched] = useState(!!tx);
  const [sypRateStr, setSypRateStr] = useState(() => (tx ? toInput(tx.sypRate, 4) : toInput(m.sypSell, 2)));
  const [notes, setNotes] = useState(tx?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [fetchingRate, setFetchingRate] = useState(false);

  const isOld = currency === SYP_OLD;
  const storeCur = isOld ? 'SYP' : currency;
  const factor = isOld ? 1 / SYP_REDENOMINATION : 1;

  useEffect(() => {
    if (usdRateTouched || storeCur === 'USD' || storeCur === 'SYP') return;
    setUsdRateStr(toInput(unitsPerUsdNow(m, storeCur), 4));
  }, [storeCur, usdRateTouched, m]);

  const q = parseNum(qty);
  const p = parseNum(priceStr);
  const fe = parseNum(fees) ?? 0;
  const unitPrice = mode === 'unit' ? p : p != null && q ? p / q : null;
  let sypRate = parseNum(sypRateStr);
  const oldRateTyped = sypRate != null && sypRate > 2000;
  if (sypRate != null && oldRateTyped) sypRate = sypRate / SYP_REDENOMINATION;
  const usdRate = storeCur === 'USD' ? 1 : storeCur === 'SYP' ? sypRate : parseNum(usdRateStr);
  const gross = q != null && unitPrice != null ? q * unitPrice * factor : null;
  const total = gross == null ? null : kind === 'buy' ? gross + fe * factor : gross - fe * factor;
  const totalUsd = total != null && usdRate ? total / usdRate : null;
  const sellTooMuch = kind === 'sell' && q != null && q > holdingQty + (tx?.kind === 'sell' ? tx.quantity : 0) + 1e-9;
  const isMetal = asset.type === 'gold' || asset.type === 'silver';

  async function getHistoricalRate() {
    setFetchingRate(true);
    try {
      const r = await fetchHistoricalUsdRate(date, storeCur);
      if (r) {
        setUsdRateStr(toInput(r, 4));
        setUsdRateTouched(true);
      }
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setFetchingRate(false);
    }
  }

  async function submit() {
    const e: Record<string, string> = {};
    if (!date) e.date = t.common.required;
    if (q == null) e.qty = qty.trim() ? t.common.enterNumber : t.common.required;
    else if (q <= 0) e.qty = t.common.mustBePositive;
    if (p == null) e.price = priceStr.trim() ? t.common.enterNumber : t.common.required;
    else if (p < 0) e.price = t.common.enterNumber;
    if (fees.trim() && parseNum(fees) == null) e.fees = t.common.enterNumber;
    if (storeCur === 'SYP' && !(sypRate && sypRate > 0)) e.sypRate = t.common.required;
    if (sypRateStr.trim() && sypRate == null) e.sypRate = t.common.enterNumber;
    if (storeCur !== 'USD' && storeCur !== 'SYP' && !(usdRate && usdRate > 0)) e.usdRate = t.common.required;
    setErrors(e);
    if (Object.keys(e).length || q == null || unitPrice == null || usdRate == null) return;

    const data: NewTx = {
      assetId: asset.id,
      kind,
      date,
      quantity: q,
      price: unitPrice * factor,
      currency: storeCur,
      fees: fe * factor,
      usdRate,
      sypRate: sypRate ?? null,
      notes: notes.trim(),
    };
    setSaving(true);
    try {
      if (tx) await editTx(tx.id, data);
      else await addTx(data);
      onClose();
    } catch (err) {
      toast(`${t.common.somethingWrong}: ${errorText(err)}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  const title = tx ? t.txForm.titleEdit : kind === 'buy' ? t.txForm.titleBuy : t.txForm.titleSell;

  return (
    <Modal
      open={open}
      title={`${title} · ${asset.name}`}
      onClose={onClose}
      wide
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-x-4 gap-y-4">
        <div className="col-span-2">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: 'buy', label: t.asset.buy },
              { value: 'sell', label: t.asset.sell },
            ]}
          />
        </div>

        <Field label={t.txForm.date} error={errors.date}>
          {(id) => <TextInput id={id} type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label={t.txForm.amount(unit)} error={errors.qty ?? (sellTooMuch ? t.asset.oversold : null)}>
          {(id) => <NumberInput id={id} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />}
        </Field>

        <Field
          label={
            <span className="flex items-center justify-between gap-2">
              <span>{mode === 'unit' ? t.txForm.perUnit(unit) : kind === 'buy' ? t.txForm.totalPaid : t.txForm.totalReceived}</span>
              <Segmented
                size="sm"
                value={mode}
                onChange={(v) => {
                  if (q && p != null) setPriceStr(toInput(v === 'total' ? p * q : p / q, 6));
                  setMode(v);
                }}
                options={[
                  { value: 'unit', label: t.txForm.modeUnit(unit) },
                  { value: 'total', label: t.txForm.total },
                ]}
              />
            </span>
          }
          error={errors.price}
        >
          {(id) => <NumberInput id={id} value={priceStr} onChange={(e) => setPriceStr(e.target.value)} placeholder="0" />}
        </Field>
        <Field label={kind === 'buy' ? t.txForm.paidIn : t.txForm.receivedIn} hint={isOld ? t.txForm.oldNote : undefined}>
          {(id) => (
            <Select id={id} value={currency} onChange={(e) => setCurrency(e.target.value)}>
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {currencyName(c.code, f.lang)}
                </option>
              ))}
              <option value={SYP_OLD}>{t.txForm.sypOld}</option>
            </Select>
          )}
        </Field>

        <Field
          label={isMetal && kind === 'buy' ? t.txForm.makingCharge : t.txForm.fees}
          optional
          hint={t.txForm.feesHelp}
          error={errors.fees}
        >
          {(id) => <NumberInput id={id} value={fees} onChange={(e) => setFees(e.target.value)} placeholder="0" />}
        </Field>
        {storeCur !== 'USD' && storeCur !== 'SYP' ? (
          <Field label={t.txForm.usdRate(storeCur)} error={errors.usdRate}>
            {(id) => (
              <div className="flex gap-2">
                <NumberInput
                  id={id}
                  value={usdRateStr}
                  onChange={(e) => {
                    setUsdRateStr(e.target.value);
                    setUsdRateTouched(true);
                  }}
                />
                {ECB_CODES.has(storeCur) && date !== todayLocal() && (
                  <Button size="sm" className="h-9" loading={fetchingRate} onClick={getHistoricalRate}>
                    {t.txForm.fetchRate}
                  </Button>
                )}
              </div>
            )}
          </Field>
        ) : (
          <div />
        )}

        <Field
          className="col-span-2"
          label={t.txForm.sypRate}
          optional={storeCur !== 'SYP'}
          error={errors.sypRate}
          hint={
            oldRateTyped && sypRate != null
              ? `${t.txForm.oldNote} → ${f.num(sypRate, 2, 2)}`
              : `${t.txForm.sypRateHelp}${sypRate ? ` (${t.common.old(f.num(sypRate * 100, 0))})` : ''}`
          }
        >
          {(id) => <NumberInput id={id} value={sypRateStr} onChange={(e) => setSypRateStr(e.target.value)} className="max-w-[220px]" />}
        </Field>

        <Field label={t.txForm.notes} optional className="col-span-2">
          {(id) => <TextArea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
      </div>

      {total != null && (
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-surface-2 px-4 py-3 text-sm">
          <span className="text-ink-2">{t.txForm.total}</span>
          <span className="tnum font-semibold text-ink">
            {f.price(total, storeCur)}
            {storeCur !== 'USD' && totalUsd != null && <span className="ms-2 font-normal text-muted">{t.txForm.approxUsd(f.price(totalUsd, 'USD'))}</span>}
          </span>
        </div>
      )}
    </Modal>
  );
}
