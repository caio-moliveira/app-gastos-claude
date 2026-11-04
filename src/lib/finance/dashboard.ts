/**
 * Monta os números do painel (PRD §6.5) a partir do razão do espaço — funções puras.
 */
import { addMonths, formatMonthShort, lastMonths, monthEnd, todayISO } from "./dates";
import { categoryBreakdown, compareValues, monthTotals, spaceTotalBalance, type AccountLike, type Change, type Tx } from "./rules";

export type DashboardSummary = {
  month: string;
  /** Saldo total das contas ativas no fim do mês (ou hoje, se for o mês atual/futuro). */
  balance: number;
  balanceAsOf: string;
  income: number;
  expense: number;
  result: number;
  vsPrevious: { income: Change; expense: Change; result: Change };
  byCategory: Array<{ category_id: string; total: number }>;
  trend: Array<{ month: string; label: string; income: number; expense: number }>;
};

export function buildDashboard(accounts: AccountLike[], ledger: Tx[], month: string, today: string = todayISO()): DashboardSummary {
  const asOf = month >= today.slice(0, 7) ? today : monthEnd(month);
  const current = monthTotals(ledger, month);
  const previous = monthTotals(ledger, addMonths(month, -1));
  return {
    month,
    balance: spaceTotalBalance(accounts, ledger, asOf),
    balanceAsOf: asOf,
    ...current,
    vsPrevious: {
      income: compareValues(previous.income, current.income),
      expense: compareValues(previous.expense, current.expense),
      result: compareValues(previous.result, current.result),
    },
    byCategory: categoryBreakdown(ledger, month, "expense"),
    trend: lastMonths(month, 6).map((m) => {
      const t = monthTotals(ledger, m);
      return { month: m, label: formatMonthShort(m), income: t.income, expense: t.expense };
    }),
  };
}


/** "+12,3 %" / "−4 %" / "—" (sem base de comparação). */
export function formatPercentChange(percent: number | null): string {
  if (percent === null) return "—";
  const abs = Math.abs(percent).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  if (percent > 0) return `+${abs} %`;
  if (percent < 0) return `−${abs} %`;
  return "0 %";
}
