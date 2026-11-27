import { useState } from 'react';
import { useT } from '../i18n';
import { parseNum, toInput } from '../lib/format';
import { saveSettings } from '../state/actions';
import { portfolioName } from '../state/derived';
import { askNotificationPermission } from '../state/notify';
import { errorText, toast, useStore } from '../state/store';
import { Button, Checkbox, Field, Modal, NumberInput, Segmented, Select } from './ui';

export function BudgetForm({ onClose }: { onClose: () => void }) {
  const t = useT();
  const s = useStore((st) => st.settings);
  const portfolios = useStore((st) => st.portfolios);
  const [limitStr, setLimitStr] = useState(toInput(s.budgetMonthly));
  const [currency, setCurrency] = useState<'USD' | 'SYP'>(s.budgetCurrency);
  const [portfolio, setPortfolio] = useState<number | null>(s.budgetPortfolio);
  const [alerts, setAlerts] = useState(s.budgetAlerts);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(limit: number | null) {
    setSaving(true);
    try {
      if (limit != null && alerts && s.notifications && s.budgetMonthly == null) await askNotificationPermission();
      // A new limit starts the month's warnings again, so you hear about it if you are already past 80%.
      await saveSettings({ budgetMonthly: limit, budgetCurrency: currency, budgetPortfolio: portfolio, budgetAlerts: alerts, budgetNotified: '' });
      onClose();
    } catch (e) {
      toast(`${t.common.somethingWrong}: ${errorText(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  function submit() {
    const v = parseNum(limitStr);
    if (v == null) return setError(limitStr.trim() ? t.common.enterNumber : t.common.required);
    if (v <= 0) return setError(t.common.mustBePositive);
    void save(v);
  }

  return (
    <Modal
      open
      title={s.budgetMonthly ? t.budget.edit : t.budget.set}
      onClose={onClose}
      footer={
        <>
          {s.budgetMonthly != null && (
            <Button variant="danger" className="me-auto" disabled={saving} onClick={() => void save(null)}>
              {t.budget.remove}
            </Button>
          )}
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <Field label={t.budget.limit} error={error} className="min-w-[200px] flex-1">
            {(id) => (
              <NumberInput
                id={id}
                value={limitStr}
                placeholder="0"
                onChange={(e) => {
                  setLimitStr(e.target.value);
                  setError(null);
                }}
              />
            )}
          </Field>
          <Field label={t.budget.currency}>
            {() => (
              <Segmented
                value={currency}
                onChange={setCurrency}
                options={[
                  { value: 'USD', label: 'USD $' },
                  { value: 'SYP', label: 'SYP' },
                ]}
              />
            )}
          </Field>
        </div>
        {portfolios.length > 1 && (
          <Field label={t.budget.portfolio}>
            {(id) => (
              <Select id={id} value={portfolio == null ? 'all' : String(portfolio)} onChange={(e) => setPortfolio(e.target.value === 'all' ? null : Number(e.target.value))}>
                <option value="all">{t.common.allPortfolios}</option>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {portfolioName(p, t)}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Checkbox checked={alerts} onChange={setAlerts} label={t.budget.alerts} />
        <p className="text-xs text-muted">{t.budget.hint}</p>
      </div>
    </Modal>
  );
}
