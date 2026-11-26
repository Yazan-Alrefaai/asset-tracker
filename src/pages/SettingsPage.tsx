import { DatabaseBackup, Download, FileSpreadsheet, FolderOpen, Upload } from 'lucide-react';
import { useEffect, useState } from 'react';
import { PageHeader } from '../components/Layout';
import { useFmt } from '../components/Money';
import { Button, Card, Checkbox, ConfirmModal, Segmented } from '../components/ui';
import { useT } from '../i18n';
import { makeBackup, parseBackup, restoreBackup, transactionsCsv } from '../lib/backup';
import { todayLocal } from '../lib/dates';
import { getDb } from '../lib/db';
import { isTauri } from '../lib/platform';
import type { Language, Theme } from '../lib/settings';
import { backupNow, reloadData, saveSettings } from '../state/actions';
import { portfolioName } from '../state/derived';
import { getDbInfo, openDataFolder, openTextFile, saveTextFile, type DbInfo } from '../state/files';
import { errorText, toast, useStore } from '../state/store';

const APP_VERSION = '0.1.0';

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line py-3 first:border-t-0 first:pt-0">
      <span className="text-sm text-ink">{label}</span>
      <div>{children}</div>
    </div>
  );
}

export function SettingsPage() {
  const t = useT();
  const f = useFmt();
  const s = useStore((st) => st.settings);
  const [info, setInfo] = useState<DbInfo | null>(null);
  const [pendingImport, setPendingImport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDbInfo().then(setInfo, () => setInfo(null));
  }, []);

  async function exportJson() {
    const st = useStore.getState();
    const backup = makeBackup({ portfolios: st.portfolios, assets: st.assets, txs: st.txs, snapshots: st.snapshots, settings: st.settings });
    if (await saveTextFile(`asset-tracker-backup-${todayLocal()}.json`, JSON.stringify(backup, null, 2), 'json')) toast(t.settings.exported);
  }

  async function exportCsv() {
    const st = useStore.getState();
    const csv = transactionsCsv({ portfolios: st.portfolios, assets: st.assets, txs: st.txs }, (p) => portfolioName(p, t));
    if (await saveTextFile(`asset-tracker-transactions-${todayLocal()}.csv`, csv, 'csv')) toast(t.settings.exported);
  }

  async function chooseImport() {
    const text = await openTextFile('json');
    if (!text) return;
    try {
      parseBackup(text);
      setPendingImport(text);
    } catch {
      toast(t.settings.invalidBackup, 'error');
    }
  }

  async function doImport() {
    if (!pendingImport) return;
    try {
      const b = parseBackup(pendingImport);
      if (isTauri) await backupNow(); // safety copy of the current data first
      await restoreBackup(await getDb(), b);
      const { settings } = b;
      if (Object.keys(settings).length) useStore.setState((st) => ({ settings: { ...st.settings, ...settings, lastBackupDate: st.settings.lastBackupDate } }));
      await reloadData();
      toast(t.settings.imported);
    } catch (e) {
      toast(`${t.common.somethingWrong}: ${errorText(e)}`, 'error');
    }
  }

  return (
    <>
      <PageHeader title={t.settings.title} />
      <div className="grid max-w-3xl gap-4">
        <Card title={t.settings.general}>
          <Row label={t.settings.language}>
            <Segmented<Language>
              value={s.language}
              onChange={(v) => void saveSettings({ language: v })}
              options={[
                { value: 'en', label: 'English' },
                { value: 'ar', label: 'العربية' },
              ]}
            />
          </Row>
          <Row label={t.settings.theme}>
            <Segmented<Theme>
              value={s.theme}
              onChange={(v) => void saveSettings({ theme: v })}
              options={[
                { value: 'system', label: t.settings.themeSystem },
                { value: 'light', label: t.settings.themeLight },
                { value: 'dark', label: t.settings.themeDark },
              ]}
            />
          </Row>
          <Row label={t.settings.mainCurrency}>
            <Segmented
              value={s.mainCurrency}
              onChange={(v) => void saveSettings({ mainCurrency: v })}
              options={[
                { value: 'USD', label: 'USD $' },
                { value: 'SYP', label: f.lang === 'ar' ? 'ليرة سورية' : 'SYP' },
              ]}
            />
          </Row>
          <Row label={t.prices.goldValuation}>
            <Segmented
              value={s.metalPricing}
              onChange={(v) => void saveSettings({ metalPricing: v })}
              options={[
                { value: 'local', label: t.prices.goldLocal },
                { value: 'global', label: t.prices.goldWorld },
              ]}
            />
          </Row>
          <Row label={t.settings.refresh}>
            <Segmented
              value={s.refreshSeconds}
              onChange={(v) => void saveSettings({ refreshSeconds: v })}
              options={[60, 300, 900].map((sec) => ({ value: sec, label: t.settings.minutes(sec / 60) }))}
            />
          </Row>
          <Row label={t.settings.showOldSyp}>
            <Checkbox checked={s.showOldSyp} onChange={(v) => void saveSettings({ showOldSyp: v })} label="" />
          </Row>
        </Card>

        <Card title={t.settings.data} subtitle={t.settings.dataInfo}>
          {info && (
            <div className="mb-4 rounded-lg bg-surface-2 px-4 py-3 text-xs">
              <div className="text-muted">{t.settings.dataFile}</div>
              <div className="mt-0.5 break-all font-mono text-ink-2" dir="ltr">
                {info.path}
              </div>
              <div className="mt-2 text-muted">
                {t.settings.autoBackup}
                {s.lastBackupDate && ` ${t.settings.lastBackup(f.date(s.lastBackupDate))}`}
              </div>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {isTauri && (
              <>
                <Button icon={<FolderOpen className="h-4 w-4" />} onClick={() => void openDataFolder()}>
                  {t.settings.openFolder}
                </Button>
                <Button
                  icon={<DatabaseBackup className="h-4 w-4" />}
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await backupNow();
                      toast(t.settings.backupSaved);
                      setInfo(await getDbInfo());
                    } catch (e) {
                      toast(errorText(e), 'error');
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  {t.settings.backupNow}
                </Button>
              </>
            )}
            <Button icon={<Download className="h-4 w-4" />} onClick={() => void exportJson().catch((e) => toast(errorText(e), 'error'))}>
              {t.settings.exportJson}
            </Button>
            <Button icon={<FileSpreadsheet className="h-4 w-4" />} onClick={() => void exportCsv().catch((e) => toast(errorText(e), 'error'))}>
              {t.settings.exportCsv}
            </Button>
            <Button icon={<Upload className="h-4 w-4" />} onClick={() => void chooseImport().catch((e) => toast(errorText(e), 'error'))}>
              {t.settings.importJson}
            </Button>
          </div>
        </Card>

        <Card title={t.settings.about}>
          <p className="text-sm text-ink">
            {t.appName} · {t.settings.version(APP_VERSION)}
          </p>
          <p className="mt-1 text-sm text-ink-2">{t.settings.license}</p>
          <p className="mt-3 text-xs leading-relaxed text-muted">{t.settings.sources}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted">{t.prices.disclaimer}</p>
        </Card>
      </div>
      <ConfirmModal
        open={!!pendingImport}
        message={t.settings.importConfirm}
        confirmLabel={t.settings.importJson}
        onClose={() => setPendingImport(null)}
        onConfirm={doImport}
      />
    </>
  );
}
