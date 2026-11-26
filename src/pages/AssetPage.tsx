import { ArrowLeft, Pencil, Plus, Minus, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AssetForm } from '../components/AssetForm';
import { AssetIcon } from '../components/AssetIcon';
import { assetDetails, unitLabel } from '../components/assetText';
import { PrivacyToggle } from '../components/Layout';
import { Dual, Pnl, useFmt } from '../components/Money';
import { TxForm } from '../components/TxForm';
import { Badge, Button, Card, ConfirmModal, EmptyState, IconButton } from '../components/ui';
import { useT } from '../i18n';
import { karatLabel } from '../lib/catalog';
import { computeHolding, sortTxs } from '../lib/calc/portfolio';
import type { Tx, TxKind } from '../lib/model';
import { removeAsset, removeTx } from '../state/actions';
import { portfolioName, useMarket } from '../state/derived';
import { go } from '../state/router';
import { useStore } from '../state/store';

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <p className="text-[13px] text-ink-2">{label}</p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function AssetPage({ id, action }: { id: number; action?: 'buy' }) {
  const t = useT();
  const f = useFmt();
  const m = useMarket();
  const asset = useStore((s) => s.assets.find((a) => a.id === id));
  const allTxs = useStore((s) => s.txs);
  const portfolios = useStore((s) => s.portfolios);
  const quotes = useStore((s) => s.quotes);
  const txs = useMemo(() => allTxs.filter((x) => x.assetId === id), [allTxs, id]);

  const [txForm, setTxForm] = useState<{ kind: TxKind; tx?: Tx } | null>(action === 'buy' ? { kind: 'buy' } : null);
  const [editing, setEditing] = useState(false);
  const [confirmAsset, setConfirmAsset] = useState(false);
  const [confirmTx, setConfirmTx] = useState<Tx | null>(null);

  // "/asset/12/buy" opens the buy form once, then the address goes back to "/asset/12".
  useEffect(() => {
    if (action === 'buy') window.history.replaceState(null, '', `#/asset/${id}`);
  }, [action, id]);

  if (!asset) {
    return (
      <Card>
        <EmptyState title={t.asset.notFound} action={<Button onClick={() => go('/')}>{t.common.back}</Button>} />
      </Card>
    );
  }

  const h = computeHolding(asset, txs, m);
  const unit = unitLabel(asset, t);
  const portfolio = portfolios.find((p) => p.id === asset.portfolioId);
  const sypFirst = f.main === 'SYP';
  const perUnit = (usd: number | null, syp: number | null, priv: boolean) =>
    sypFirst && syp != null
      ? priv
        ? f.money(syp, 'SYP')
        : f.price(syp, 'SYP')
      : usd != null
        ? priv
          ? f.money(usd, 'USD')
          : f.price(usd, 'USD')
        : '—';

  const karat = karatLabel(asset.purity);
  const quoteKey =
    asset.type === 'crypto'
      ? `crypto:${asset.symbol}`
      : asset.type === 'stock'
        ? `stock:${asset.symbol.toUpperCase()}`
        : asset.type === 'gold'
          ? h.unit.basis === 'local'
            ? `sygold:${karat && quotes[`sygold:${karat}`] ? karat : '24K'}`
            : 'metal:XAU'
          : asset.type === 'silver'
            ? 'metal:XAG'
            : asset.type === 'cash'
              ? 'syp:USD'
              : '';
  const q = quoteKey ? quotes[quoteKey] : undefined;
  const sorted = sortTxs(txs).reverse();

  return (
    <>
      <button type="button" onClick={() => go('/')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
        {t.nav.dashboard}
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <AssetIcon type={asset.type} size="lg" />
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold text-ink">{asset.name}</h1>
            <p className="mt-0.5 truncate text-sm text-muted">
              {[t.types[asset.type], assetDetails(asset, t, f.lang), portfolioName(portfolio, t)].filter(Boolean).join(' · ')}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PrivacyToggle />
          <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setTxForm({ kind: 'buy' })}>
            {t.asset.addBuy}
          </Button>
          <Button icon={<Minus className="h-4 w-4" />} onClick={() => setTxForm({ kind: 'sell' })} disabled={h.quantity <= 0}>
            {t.asset.addSell}
          </Button>
          <IconButton label={t.asset.editAsset} onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
          </IconButton>
          <IconButton label={t.asset.deleteAsset} onClick={() => setConfirmAsset(true)} className="hover:text-neg">
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {h.oversold && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm text-warn">
          <TriangleAlert className="h-4 w-4 shrink-0" />
          {t.asset.oversold}
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        <Tile label={t.asset.youHold}>
          <div className="tnum text-[15px] font-medium text-ink">
            {f.qty(h.quantity, asset.type)} <span className="text-sm text-muted">{unit}</span>
          </div>
        </Tile>
        <Tile label={t.asset.avgCost}>
          <div className="tnum text-[15px] font-medium text-ink">{perUnit(h.avgCostUsd, h.avgCostSyp, true)}</div>
          <div className="text-xs text-muted">{t.asset.unitPrice(unit)}</div>
        </Tile>
        <Tile label={t.asset.value}>
          <Dual usd={h.valueUsd} syp={h.valueSyp} size="md" />
        </Tile>
        <Tile label={h.quantity > 0 ? t.asset.pnl : t.asset.realized}>
          {h.quantity > 0 ? (
            <Pnl usd={h.pnlUsd} syp={h.pnlSyp} pctUsd={h.pnlPct} pctSyp={h.pnlPctSyp} />
          ) : (
            <Pnl usd={h.realizedUsd} syp={h.realizedSyp} pctUsd={null} pctSyp={null} />
          )}
        </Tile>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
        <span>
          {t.asset.priceSource}: <span className="tnum text-ink-2">{perUnit(h.unit.usd, h.unit.syp, false)}</span> / {unit}
        </span>
        <Badge tone={h.unit.basis === 'none' ? 'warn' : h.unit.basis === 'manual' ? 'accent' : 'neutral'}>{t.basis[h.unit.basis]}</Badge>
        {q && h.unit.basis !== 'manual' && <span>{t.common.updated(f.ago(q.asOf ?? q.fetchedAt))}</span>}
        {h.quantity > 0 && h.realizedUsd !== 0 && (
          <span>
            · {t.asset.realized}: <span className="tnum">{f.money(sypFirst && h.realizedSyp != null ? h.realizedSyp : h.realizedUsd, sypFirst && h.realizedSyp != null ? 'SYP' : 'USD', { sign: true })}</span>
          </span>
        )}
      </div>

      <Card title={t.asset.transactions} className="mt-5" bodyClassName="p-0 pt-3">
        {sorted.length === 0 ? (
          <EmptyState
            title={t.asset.noTx}
            action={
              <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setTxForm({ kind: 'buy' })}>
                {t.asset.addBuy}
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-xs text-muted">
                  <th className="pb-2 pe-3 ps-5 text-start font-medium">{t.asset.colDate}</th>
                  <th className="px-3 pb-2 text-start font-medium">{t.asset.colType}</th>
                  <th className="px-3 pb-2 text-end font-medium">{t.asset.colQty}</th>
                  <th className="px-3 pb-2 text-end font-medium">{t.asset.colPrice}</th>
                  <th className="px-3 pb-2 text-end font-medium">{t.asset.colFees}</th>
                  <th className="px-3 pb-2 text-end font-medium">{t.asset.colTotal}</th>
                  <th className="px-3 pb-2 text-end font-medium">{t.asset.colRate}</th>
                  <th className="pb-2 pe-5 ps-3" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((x) => {
                  const gross = x.quantity * x.price;
                  const total = x.kind === 'buy' ? gross + x.fees : gross - x.fees;
                  return (
                    <tr key={x.id} className="border-t border-line">
                      <td className="tnum py-2.5 pe-3 ps-5 text-ink-2">
                        {f.date(x.date)}
                        {x.notes && <div className="max-w-[220px] truncate text-xs text-muted" title={x.notes}>{x.notes}</div>}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={x.kind === 'buy' ? 'pos' : 'neg'}>{x.kind === 'buy' ? t.asset.buy : t.asset.sell}</Badge>
                      </td>
                      <td className="tnum px-3 py-2.5 text-end text-ink">{f.qty(x.quantity, asset.type)}</td>
                      <td className="tnum px-3 py-2.5 text-end text-ink-2">{f.money(x.price, x.currency)}</td>
                      <td className="tnum px-3 py-2.5 text-end text-ink-2">{x.fees ? f.money(x.fees, x.currency) : '—'}</td>
                      <td className="tnum px-3 py-2.5 text-end font-medium text-ink">{f.money(total, x.currency)}</td>
                      <td className="tnum px-3 py-2.5 text-end text-xs text-muted">
                        {x.currency !== 'USD' && x.currency !== 'SYP' && <div>{f.num(x.usdRate, 4)} {x.currency}</div>}
                        {x.sypRate != null ? <div>{f.num(x.sypRate, 2, 2)} SYP</div> : x.currency === 'USD' ? '—' : null}
                      </td>
                      <td className="py-2.5 pe-5 ps-3">
                        <div className="flex justify-end gap-1">
                          <IconButton label={t.common.edit} onClick={() => setTxForm({ kind: x.kind, tx: x })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </IconButton>
                          <IconButton label={t.common.delete} onClick={() => setConfirmTx(x)} className="hover:text-neg">
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {asset.notes && (
        <Card title={t.assetForm.notes} className="mt-4">
          <p className="whitespace-pre-wrap text-sm text-ink-2">{asset.notes}</p>
        </Card>
      )}

      {txForm && (
        <TxForm
          open
          onClose={() => setTxForm(null)}
          asset={asset}
          kind={txForm.kind}
          tx={txForm.tx}
          holdingQty={h.quantity}
        />
      )}
      {editing && <AssetForm open asset={asset} onClose={() => setEditing(false)} />}
      <ConfirmModal
        open={confirmAsset}
        message={t.asset.confirmDelete(asset.name)}
        confirmLabel={t.asset.deleteAsset}
        onClose={() => setConfirmAsset(false)}
        onConfirm={async () => {
          await removeAsset(asset.id);
          go('/');
        }}
      />
      <ConfirmModal
        open={!!confirmTx}
        message={t.asset.confirmDeleteTx}
        confirmLabel={t.common.delete}
        onClose={() => setConfirmTx(null)}
        onConfirm={async () => {
          if (confirmTx) await removeTx(confirmTx.id);
        }}
      />
    </>
  );
}
