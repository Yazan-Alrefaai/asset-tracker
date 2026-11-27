import { useEffect, useMemo, useState } from 'react';
import { useT } from '../i18n';
import { builtInCategories, customCategories, isBuiltInCategory, normalizeFlowMoney } from '../lib/cashflow';
import { CURRENCIES, SYP_OLD } from '../lib/catalog';
import { unitsPerUsdNow } from '../lib/calc/market';
import { todayLocal } from '../lib/dates';
import { parseNum, toInput } from '../lib/format';
import type { CashFlow, FlowKind, NewCashFlow } from '../lib/model';
import { addCashFlow, editCashFlow } from '../state/actions';
import { portfolioName, useMarket } from '../state/derived';
import { errorText, toast, useStore } from '../state/store';
import { currencyName } from './assetText';
import { categoryLabel } from './flowText';
import { useFmt } from './Money';
import { Button, Field, Modal, NumberInput, Segmented, Select, TextArea, TextInput } from './ui';

const CUSTOM = '__custom__';
export const MAX_CATEGORY_LENGTH = 60;

export interface FlowFormProps {
  onClose: () => void;
  /** New entry of this kind (ignored when editing or copying). */
  kind?: FlowKind;
  /** Edit this entry. */
  flow?: CashFlow;
  /** Start a new entry from this one, dated today (rates of today). */
  copyOf?: CashFlow;
  defaultPortfolioId?: number;
}

export function FlowForm({ onClose, kind: initialKind = 'expense', flow, copyOf, defaultPortfolioId }: FlowFormProps) {
  const t = useT();
  const f = useFmt();
  const m = useMarket();
  const portfolios = useStore((s) => s.portfolios);
  const allFlows = useStore((s) => s.cashflows);
  const mainCurrency = useStore((s) => s.settings.mainCurrency);
  const src = flow ?? copyOf;

  const [kind, setKind] = useState<FlowKind>(src?.kind ?? initialKind);
  const [date, setDate] = useState(flow?.date ?? todayLocal());
  const [amountStr, setAmountStr] = useState(toInput(src?.amount));
  const [currency, setCurrency] = useState(src?.currency ?? mainCurrency);
  const [categoryChoice, setCategoryChoice] = useState(() => {
    if (!src) return builtInCategories(initialKind)[0];
    return isBuiltInCategory(src.kind, src.category) ? src.category : CUSTOM;
  });
  const [customCategory, setCustomCategory] = useState(src && !isBuiltInCategory(src.kind, src.category) ? src.category : '');
  const [portfolioId, setPortfolioId] = useState(src?.portfolioId ?? defaultPortfolioId ?? portfolios[0]?.id ?? 1);
  // Editing keeps the saved rates; a new entry or a copy starts from today's market rates.
  const [usdRateStr, setUsdRateStr] = useState(() =>
    flow && flow.currency !== 'USD' && flow.currency !== 'SYP' ? toInput(flow.usdRate) : toInput(unitsPerUsdNow(m, currency), 4),
  );
  const [usdRateTouched, setUsdRateTouched] = useState(!!flow);
  const [sypRateStr, setSypRateStr] = useState(() => (flow ? toInput(flow.sypRate, 4) : toInput(m.sypSell, 2)));
  const [note, setNote] = useState(src?.note ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const isOld = currency === SYP_OLD;
  const storeCur = isOld ? 'SYP' : currency;

  // Keep the USD rate in step with the chosen currency until the user types their own.
  useEffect(() => {
    if (usdRateTouched || storeCur === 'USD' || storeCur === 'SYP') return;
    setUsdRateStr(toInput(unitsPerUsdNow(m, storeCur), 4));
  }, [storeCur, usdRateTouched, m]);

  const suggestions = useMemo(() => customCategories(allFlows, kind), [allFlows, kind]);

  function changeKind(k: FlowKind) {
    setKind(k);
    if (categoryChoice !== CUSTOM && !isBuiltInCategory(k, categoryChoice)) setCategoryChoice(builtInCategories(k)[0]);
  }

  const amount = parseNum(amountStr);
  const sypTyped = parseNum(sypRateStr);
  const money = amount != null ? normalizeFlowMoney(currency, amount, sypTyped) : null;
  const sypRate = normalizeFlowMoney(currency, amount ?? 0, sypTyped).sypRate;
  const oldRateTyped = sypTyped != null && sypRate !== sypTyped;
  const usdRate = storeCur === 'USD' ? 1 : storeCur === 'SYP' ? sypRate : parseNum(usdRateStr);
  const usdValue = money && usdRate && usdRate > 0 ? money.amount / usdRate : null;
  const sypValue = money ? (storeCur === 'SYP' ? money.amount : usdValue != null && sypRate ? usdValue * sypRate : null) : null;
  const category = categoryChoice === CUSTOM ? customCategory.trim() : categoryChoice;

  async function submit() {
    const e: Record<string, string> = {};
    if (!date) e.date = t.common.required;
    if (amount == null) e.amount = amountStr.trim() ? t.common.enterNumber : t.common.required;
    else if (amount <= 0) e.amount = t.common.mustBePositive;
    if (categoryChoice === CUSTOM && !category) e.category = t.common.required;
    if (category.length > MAX_CATEGORY_LENGTH) e.category = t.cashflow.form.tooLong;
    if (sypRateStr.trim() && sypTyped == null) e.sypRate = t.common.enterNumber;
    else if (sypTyped != null && sypTyped <= 0) e.sypRate = t.common.mustBePositive;
    if (storeCur === 'SYP' && !(sypRate && sypRate > 0)) e.sypRate = e.sypRate ?? t.common.required;
    if (storeCur !== 'USD' && storeCur !== 'SYP' && !(usdRate && usdRate > 0)) e.usdRate = t.common.required;
    setErrors(e);
    if (Object.keys(e).length || !money || usdRate == null) return;

    const data: NewCashFlow = {
      portfolioId,
      kind,
      date,
      amount: money.amount,
      currency: money.currency,
      category,
      usdRate,
      sypRate: sypRate ?? null,
      note: note.trim(),
    };
    setSaving(true);
    try {
      if (flow) await editCashFlow(flow.id, data);
      else await addCashFlow(data);
      onClose();
    } catch (err) {
      toast(`${t.common.somethingWrong}: ${errorText(err)}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  const title = flow ? t.cashflow.form.titleEdit : kind === 'income' ? t.cashflow.form.titleIncome : t.cashflow.form.titleExpense;
  const listId = 'flow-category-suggestions';

  return (
    <Modal
      open
      title={title}
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
            onChange={changeKind}
            options={[
              { value: 'income', label: t.cashflow.income },
              { value: 'expense', label: t.cashflow.expense },
            ]}
          />
        </div>

        <Field label={t.cashflow.form.date} error={errors.date}>
          {(id) => <TextInput id={id} type="date" value={date} max={todayLocal()} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label={t.cashflow.form.category} error={categoryChoice === CUSTOM ? undefined : errors.category}>
          {(id) => (
            <Select id={id} value={categoryChoice} onChange={(e) => setCategoryChoice(e.target.value)}>
              {builtInCategories(kind).map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(kind, c, t)}
                </option>
              ))}
              <option value={CUSTOM}>{t.cashflow.form.customOption}</option>
            </Select>
          )}
        </Field>

        {categoryChoice === CUSTOM && (
          <Field className="col-span-2" label={t.cashflow.form.customName} error={errors.category}>
            {(id) => (
              <>
                <TextInput
                  id={id}
                  list={listId}
                  value={customCategory}
                  maxLength={MAX_CATEGORY_LENGTH + 20}
                  placeholder={t.cashflow.form.customPlaceholder}
                  onChange={(e) => setCustomCategory(e.target.value)}
                />
                <datalist id={listId}>
                  {suggestions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
        )}

        <Field label={t.cashflow.form.amount} error={errors.amount}>
          {(id) => <NumberInput id={id} value={amountStr} onChange={(e) => setAmountStr(e.target.value)} placeholder="0" />}
        </Field>
        <Field label={t.cashflow.form.currency} hint={isOld ? t.txForm.oldNote : undefined}>
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

        {storeCur !== 'USD' && storeCur !== 'SYP' && (
          <Field className="col-span-2" label={t.txForm.usdRate(storeCur)} error={errors.usdRate}>
            {(id) => (
              <NumberInput
                id={id}
                className="max-w-[220px]"
                value={usdRateStr}
                onChange={(e) => {
                  setUsdRateStr(e.target.value);
                  setUsdRateTouched(true);
                }}
              />
            )}
          </Field>
        )}

        <Field
          className="col-span-2"
          label={t.txForm.sypRate}
          optional={storeCur !== 'SYP'}
          error={errors.sypRate}
          hint={
            oldRateTyped && sypRate != null
              ? `${t.txForm.oldNote} → ${f.num(sypRate, 2, 2)}`
              : `${t.cashflow.form.sypRateHelp}${sypRate ? ` (${t.common.old(f.num(sypRate * 100, 0))})` : ''}`
          }
        >
          {(id) => <NumberInput id={id} value={sypRateStr} onChange={(e) => setSypRateStr(e.target.value)} className="max-w-[220px]" />}
        </Field>

        {portfolios.length > 1 && (
          <Field label={t.cashflow.form.portfolio}>
            {(id) => (
              <Select id={id} value={String(portfolioId)} onChange={(e) => setPortfolioId(Number(e.target.value))}>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {portfolioName(p, t)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        <Field label={t.cashflow.form.note} optional className="col-span-2">
          {(id) => <TextArea id={id} value={note} placeholder={kind === 'income' ? t.cashflow.form.notePlaceholderIncome : t.cashflow.form.notePlaceholderExpense} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </div>

      {money && usdValue != null && (
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-surface-2 px-4 py-3 text-sm">
          <span className="text-ink-2">{kind === 'income' ? t.cashflow.income : t.cashflow.expense}</span>
          <span className="tnum font-semibold text-ink">
            {f.price(money.amount, money.currency)}
            {money.currency !== 'USD' && <span className="ms-2 font-normal text-muted">{t.txForm.approxUsd(f.price(usdValue, 'USD'))}</span>}
            {money.currency !== 'SYP' && sypValue != null && (
              <span className="ms-2 font-normal text-muted">{t.txForm.approxUsd(f.price(sypValue, 'SYP'))}</span>
            )}
          </span>
        </div>
      )}
    </Modal>
  );
}
