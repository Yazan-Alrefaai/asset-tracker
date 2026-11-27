/** Monthly budget warnings for income & expenses (80% and 100%, once each per month). */
import { MESSAGES } from '../i18n';
import { budgetStatus, budgetWarning } from '../lib/budget';
import { buildMarket } from '../lib/calc/market';
import { monthOf } from '../lib/cashflow';
import { todayLocal } from '../lib/dates';
import { getDb } from '../lib/db';
import * as repo from '../lib/db/repo';
import { fmtMoney } from '../lib/format';
import { serial } from '../lib/serial';
import { notifyUser } from './notices';
import { useStore } from './store';

export const checkBudget = serial(async (): Promise<void> => {
  const st = useStore.getState();
  const s = st.settings;
  if (!s.budgetAlerts || !s.budgetMonthly) return;
  const month = monthOf(todayLocal());
  const status = budgetStatus(
    st.cashflows,
    month,
    { limit: s.budgetMonthly, currency: s.budgetCurrency, portfolioId: s.budgetPortfolio },
    buildMarket(st.quotes, s).sypBuy,
  );
  const level = budgetWarning(status, s.budgetNotified);
  if (!level || !status) return;

  // Remember first, so a slow notification can never send the same warning twice.
  const mark = `${month}:${level}`;
  await repo.setSetting(await getDb(), 'budgetNotified', mark);
  useStore.setState((x) => ({ settings: { ...x.settings, budgetNotified: mark } }));

  const t = MESSAGES[s.language];
  const spent = fmtMoney(status.spent, status.currency, s.language);
  const limit = fmtMoney(status.limit, status.currency, s.language);
  await notifyUser({
    kind: 'budget',
    title: level === 100 ? t.budget.overTitle : t.budget.nearTitle,
    body: t.budget.body(spent, limit),
    refId: null,
    data: { type: 'budget', level, spent: status.spent, limit: status.limit, currency: status.currency },
  });
});
