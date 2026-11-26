import { Bell, BellOff, BellRing, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AlertForm } from '../components/AlertForm';
import { PageHeader, useTicker } from '../components/Layout';
import { useFmt } from '../components/Money';
import { Badge, Button, Card, ConfirmModal, EmptyState, IconButton, cx } from '../components/ui';
import { useT } from '../i18n';
import { alertCurrency, alertTargetLabel, alertValue, fmtAlertValue } from '../lib/alerts';
import type { Alert } from '../lib/model';
import { removeAlert, toggleAlert } from '../state/alerts';
import { totalsOf, useMarket } from '../state/derived';
import { askNotificationPermission, notificationsAllowed, sendSystemNotification } from '../state/notify';
import { useStore } from '../state/store';

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      title={label}
      onClick={() => onChange(!on)}
      className={cx(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        on ? 'bg-accent' : 'bg-line',
      )}
    >
      <span className={cx('inline-block h-4 w-4 rounded-full bg-white shadow transition', on ? 'translate-x-[18px] rtl:-translate-x-[18px]' : 'translate-x-0.5 rtl:-translate-x-0.5')} />
    </button>
  );
}

export function AlertsPage() {
  const t = useT();
  const f = useFmt();
  const m = useMarket();
  useTicker(20_000);
  const alerts = useStore((s) => s.alerts);
  const assets = useStore((s) => s.assets);
  const txs = useStore((s) => s.txs);
  const notificationsOn = useStore((s) => s.settings.notifications);
  const totals = useMemo(() => totalsOf({ assets, txs }, m), [assets, txs, m]);
  const [form, setForm] = useState<{ alert?: Alert } | null>(null);
  const [toDelete, setToDelete] = useState<Alert | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    notificationsAllowed().then(setAllowed);
  }, []);

  return (
    <>
      <PageHeader title={t.alerts.title}>
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setForm({})}>
          {t.alerts.add}
        </Button>
      </PageHeader>

      {notificationsOn && allowed === false && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-ink">
          <span className="flex items-center gap-2">
            <BellOff className="h-4 w-4 text-warn" />
            {t.alerts.notificationsOff}
          </span>
          <Button size="sm" onClick={async () => setAllowed(await askNotificationPermission())}>
            {t.alerts.allowNotifications}
          </Button>
        </div>
      )}

      <p className="mb-5 max-w-3xl text-sm text-ink-2">{t.alerts.keepRunning}</p>

      {alerts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell className="h-10 w-10" />}
            title={t.alerts.emptyTitle}
            body={t.alerts.emptyBody}
            action={
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setForm({})}>
                {t.alerts.add}
              </Button>
            }
          />
        </Card>
      ) : (
        <Card bodyClassName="p-0">
          <ul>
            {alerts.map((a) => {
              const cur = alertCurrency(a.target, m);
              const now = alertValue(a.target, m, totals);
              const fired = a.state === 'fired';
              return (
                <li key={a.id} className={cx('flex flex-wrap items-center gap-4 border-t border-line px-5 py-3.5 first:border-t-0', !a.active && !fired && 'opacity-60')}>
                  <span className={cx('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', fired ? 'bg-accent/15 text-accent-ink' : 'bg-surface-2 text-ink-2')}>
                    {fired ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                  </span>
                  <div className="min-w-[220px] flex-1">
                    <div className="text-sm font-medium text-ink">{alertTargetLabel(a.target, t)}</div>
                    <div className="mt-0.5 text-[13px] text-ink-2">
                      {a.condition === 'above' ? t.alerts.above : t.alerts.below}{' '}
                      <span className="tnum font-semibold text-ink">{fmtAlertValue(a.value, cur, a.target, f.lang)}</span>
                      <span className="mx-2 text-muted">·</span>
                      <span className="text-muted">{t.alerts.now(fmtAlertValue(now, cur, a.target, f.lang))}</span>
                    </div>
                    {(a.note || a.lastTriggeredAt) && (
                      <div className="mt-0.5 text-xs text-muted">
                        {[a.note, a.lastTriggeredAt ? t.alerts.lastTriggered(f.ago(a.lastTriggeredAt)) : ''].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={fired ? 'accent' : !a.active ? 'neutral' : 'pos'}>
                      {fired ? t.alerts.triggered : !a.active ? t.alerts.off : t.alerts.waiting}
                    </Badge>
                    <Badge>{a.repeat ? t.alerts.everyTime : t.alerts.once}</Badge>
                    <Switch on={a.active} onChange={(v) => void toggleAlert(a.id, v)} label={a.active ? t.alerts.on : t.alerts.off} />
                    <IconButton label={t.common.edit} onClick={() => setForm({ alert: a })}>
                      <Pencil className="h-4 w-4" />
                    </IconButton>
                    <IconButton label={t.common.delete} className="hover:text-neg" onClick={() => setToDelete(a)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {notificationsOn && allowed && (
        <div className="mt-4">
          <Button size="sm" variant="ghost" icon={<BellRing className="h-3.5 w-3.5" />} onClick={() => void sendSystemNotification(t.appName, t.alerts.testBody)}>
            {t.alerts.testNotification}
          </Button>
        </div>
      )}

      {form && <AlertForm alert={form.alert} onClose={() => setForm(null)} />}
      <ConfirmModal
        open={!!toDelete}
        message={t.alerts.confirmDelete}
        confirmLabel={t.common.delete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await removeAlert(toDelete.id);
        }}
      />
    </>
  );
}
