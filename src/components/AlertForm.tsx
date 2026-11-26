import { useMemo, useState } from 'react';
import { useT } from '../i18n';
import { alertCurrency, alertTargets, alertValue, fmtAlertValue, suggestAlertValue } from '../lib/alerts';
import { parseNum, toInput } from '../lib/format';
import type { Alert, AlertCondition } from '../lib/model';
import { addAlert, editAlert } from '../state/alerts';
import { totalsOf, useMarket } from '../state/derived';
import { askNotificationPermission } from '../state/notify';
import { errorText, toast, useStore } from '../state/store';
import { useFmt } from './Money';
import { Button, Checkbox, Field, Modal, NumberInput, Segmented, Select, TextInput } from './ui';

function roundForInput(v: number | null): string {
  if (v == null) return '';
  if (v >= 1000) return String(Math.round(v));
  if (v >= 1) return toInput(v, 2);
  return toInput(v, 6);
}

export function AlertForm({
  onClose,
  alert,
  defaultTarget,
}: {
  onClose: () => void;
  alert?: Alert;
  defaultTarget?: string;
}) {
  const t = useT();
  const f = useFmt();
  const m = useMarket();
  const assets = useStore((s) => s.assets);
  const txs = useStore((s) => s.txs);
  const notificationsOn = useStore((s) => s.settings.notifications);
  const alertCount = useStore((s) => s.alerts.length);

  const options = useMemo(
    () =>
      alertTargets(
        m,
        {
          crypto: assets.filter((a) => a.type === 'crypto' && !a.archived).map((a) => a.symbol),
          stocks: assets.filter((a) => a.type === 'stock' && !a.archived).map((a) => a.symbol),
        },
        t,
      ),
    [m, assets, t],
  );
  const totals = useMemo(() => totalsOf({ assets, txs }, m), [assets, txs, m]);

  const [target, setTarget] = useState(alert?.target ?? defaultTarget ?? options[0]?.target ?? 'metal:XAU');
  const current = alertValue(target, m, totals);
  const currency = alertCurrency(target, m);
  const [condition, setCondition] = useState<AlertCondition>(alert?.condition ?? 'above');
  const [valueStr, setValueStr] = useState(alert ? roundForInput(alert.value) : roundForInput(suggestAlertValue(current, 'above')));
  const [valueTouched, setValueTouched] = useState(!!alert);
  const [repeat, setRepeat] = useState(alert?.repeat ?? false);
  const [note, setNote] = useState(alert?.note ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const value = parseNum(valueStr);
  const alreadyMet = value != null && current != null && (condition === 'above' ? current >= value : current <= value);
  const allOptions = options.some((o) => o.target === target) ? options : [{ target, label: target, group: 'total' as const }, ...options];
  const groups = ['metals', 'syp', 'crypto', 'stocks', 'total'] as const;

  async function save() {
    if (value == null) return setError(valueStr.trim() ? t.common.enterNumber : t.common.required);
    if (value <= 0) return setError(t.common.mustBePositive);
    setSaving(true);
    try {
      if (notificationsOn && alertCount === 0 && !alert) await askNotificationPermission();
      const data = { target, condition, value, repeat, note: note.trim() };
      if (alert) await editAlert(alert.id, data);
      else await addAlert(data);
      onClose();
    } catch (e) {
      toast(`${t.common.somethingWrong}: ${errorText(e)}`, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={alert ? t.alerts.edit : t.alerts.add}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t.common.cancel}</Button>
          <Button variant="primary" loading={saving} onClick={save}>
            {t.common.save}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t.alerts.what} hint={t.alerts.now(fmtAlertValue(current, currency, target, f.lang))}>
          {(id) => (
            <Select
              id={id}
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setValueStr(roundForInput(suggestAlertValue(alertValue(e.target.value, m, totals), condition)));
                setValueTouched(false);
              }}
            >
              {groups.map((g) => {
                const items = allOptions.filter((o) => o.group === g);
                return items.length ? (
                  <optgroup key={g} label={t.alerts.groups[g]}>
                    {items.map((o) => (
                      <option key={o.target} value={o.target}>
                        {o.label}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </Select>
          )}
        </Field>
        <div className="flex flex-wrap items-end gap-4">
          <Field label={t.alerts.condition}>
            {() => (
              <Segmented
                value={condition}
                onChange={(c) => {
                  setCondition(c);
                  if (!valueTouched) setValueStr(roundForInput(suggestAlertValue(current, c)));
                }}
                options={[
                  { value: 'above', label: t.alerts.above },
                  { value: 'below', label: t.alerts.below },
                ]}
              />
            )}
          </Field>
          <Field label={`${t.alerts.value} (${currency})`} error={error} className="min-w-[180px] flex-1">
            {(id) => (
              <NumberInput
                id={id}
                value={valueStr}
                onChange={(e) => {
                  setValueStr(e.target.value);
                  setValueTouched(true);
                  setError(null);
                }}
              />
            )}
          </Field>
        </div>
        {alreadyMet && <p className="rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">{t.alerts.alreadyMet}</p>}
        <Checkbox checked={repeat} onChange={setRepeat} label={t.alerts.repeat} />
        <Field label={t.alerts.note} optional>
          {(id) => <TextInput id={id} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.alerts.notePlaceholder} />}
        </Field>
      </div>
    </Modal>
  );
}
