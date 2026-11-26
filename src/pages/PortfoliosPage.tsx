import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader, PrivacyToggle } from '../components/Layout';
import { Dual, Pnl, useFmt } from '../components/Money';
import { Button, Card, ConfirmModal, Field, IconButton, Modal, Segmented, TextInput } from '../components/ui';
import { useT } from '../i18n';
import { summarize } from '../lib/calc/portfolio';
import type { Portfolio, PortfolioKind } from '../lib/model';
import { addPortfolio, editPortfolio, removePortfolio } from '../state/actions';
import { portfolioName, useHoldings } from '../state/derived';
import { go } from '../state/router';
import { errorText, toast, useStore } from '../state/store';

function PortfolioDialog({ portfolio, onClose }: { portfolio?: Portfolio; onClose: () => void }) {
  const t = useT();
  const [name, setName] = useState(portfolio ? portfolioName(portfolio, t) : '');
  const [kind, setKind] = useState<PortfolioKind>(portfolio?.kind ?? 'business');
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      if (portfolio) await editPortfolio({ ...portfolio, name: name.trim(), kind });
      else await addPortfolio({ name: name.trim(), kind });
      onClose();
    } catch (e) {
      toast(errorText(e), 'error');
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      open
      title={portfolio ? t.common.edit : t.portfolios.add}
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
        <Field label={t.portfolios.name}>
          {(id) => <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder={t.defaultPortfolioNames[kind]} />}
        </Field>
        <Field label={t.portfolios.kind}>
          {() => (
            <Segmented
              value={kind}
              onChange={setKind}
              options={(['personal', 'business', 'other'] as PortfolioKind[]).map((k) => ({ value: k, label: t.portfolioKinds[k] }))}
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}

export function PortfoliosPage() {
  const t = useT();
  const f = useFmt();
  const portfolios = useStore((s) => s.portfolios);
  const holdings = useHoldings('all');
  const [dialog, setDialog] = useState<{ portfolio?: Portfolio } | null>(null);
  const [toDelete, setToDelete] = useState<Portfolio | null>(null);

  const byPortfolio = useMemo(() => {
    const map = new Map<number, ReturnType<typeof summarize>>();
    for (const p of portfolios) map.set(p.id, summarize(holdings.filter((h) => h.asset.portfolioId === p.id)));
    return map;
  }, [portfolios, holdings]);

  return (
    <>
      <PageHeader title={t.portfolios.title}>
        <PrivacyToggle />
        <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setDialog({})}>
          {t.portfolios.add}
        </Button>
      </PageHeader>
      <p className="-mt-3 mb-5 max-w-2xl text-sm text-ink-2">{t.portfolios.hint}</p>
      <div className="grid grid-cols-2 gap-4">
        {portfolios.map((p) => {
          const s = byPortfolio.get(p.id);
          const count = holdings.filter((h) => h.asset.portfolioId === p.id && h.quantity > 0).length;
          return (
            <Card
              key={p.id}
              title={
                <button
                  type="button"
                  className="hover:underline"
                  onClick={() => {
                    useStore.setState({ portfolioFilter: p.id });
                    go('/');
                  }}
                >
                  {portfolioName(p, t)}
                </button>
              }
              subtitle={`${t.portfolioKinds[p.kind]} · ${t.portfolios.assets(count)}`}
              actions={
                <>
                  <IconButton label={t.common.edit} onClick={() => setDialog({ portfolio: p })}>
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label={t.common.delete}
                    className="hover:text-neg"
                    onClick={() => (portfolios.length > 1 ? setToDelete(p) : toast(t.portfolios.lastOne, 'error'))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </>
              }
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <Dual usd={s?.valueUsd ?? 0} syp={s?.valueSyp ?? null} size="lg" />
                {s && s.openCount > 0 && <Pnl usd={s.pnlUsd} syp={s.pnlSyp} pctUsd={s.pnlPct} pctSyp={s.pnlPctSyp} size="sm" />}
              </div>
              {f.privacy && <span className="sr-only">hidden</span>}
            </Card>
          );
        })}
      </div>
      {dialog && <PortfolioDialog portfolio={dialog.portfolio} onClose={() => setDialog(null)} />}
      <ConfirmModal
        open={!!toDelete}
        message={toDelete ? t.portfolios.confirmDelete(portfolioName(toDelete, t)) : ''}
        confirmLabel={t.common.delete}
        onClose={() => setToDelete(null)}
        onConfirm={async () => {
          if (toDelete) await removePortfolio(toDelete.id);
        }}
      />
    </>
  );
}
