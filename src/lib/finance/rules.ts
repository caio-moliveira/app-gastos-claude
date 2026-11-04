/**
 * Regras financeiras do PRD §5 como funções puras (sem banco nem rede).
 * Toda entrada já vem filtrada por espaço (RLS); aqui só há aritmética de centavos.
 */
import { monthOf } from "./dates";

export type TxType = "income" | "expense" | "transfer";

export type Tx = {
  id?: string;
  account_id: string;
  transfer_to_account_id: string | null;
  category_id: string | null;
  type: TxType;
  amount_cents: number;
  date: string; // AAAA-MM-DD
};

export type AccountLike = {
  id: string;
  initial_balance_cents: number;
  archived: boolean;
};

/**
 * Saldo de uma conta = saldo inicial + receitas − despesas + transferências recebidas
 * − transferências enviadas, considerando só transações até `asOf` (inclusive).
 */
export function accountBalance(account: AccountLike, txs: Tx[], asOf?: string): number {
  let balance = account.initial_balance_cents;
  for (const tx of txs) {
    if (asOf && tx.date > asOf) continue;
    if (tx.type === "income" && tx.account_id === account.id) balance += tx.amount_cents;
    else if (tx.type === "expense" && tx.account_id === account.id) balance -= tx.amount_cents;
    else if (tx.type === "transfer") {
      if (tx.account_id === account.id) balance -= tx.amount_cents;
      if (tx.transfer_to_account_id === account.id) balance += tx.amount_cents;
    }
  }
  return balance;
}

/** Saldos de todas as contas, em um mapa id → centavos. */
export function accountBalances(accounts: AccountLike[], txs: Tx[], asOf?: string): Map<string, number> {
  return new Map(accounts.map((a) => [a.id, accountBalance(a, txs, asOf)]));
}

/** Saldo total do espaço = soma dos saldos das contas não arquivadas. */
export function spaceTotalBalance(accounts: AccountLike[], txs: Tx[], asOf?: string): number {
  return accounts.filter((a) => !a.archived).reduce((sum, a) => sum + accountBalance(a, txs, asOf), 0);
}

export type MonthTotals = { income: number; expense: number; result: number };

/** Receita e despesa do mês somam só `income` e `expense`; transferências nunca entram. */
export function monthTotals(txs: Tx[], month: string): MonthTotals {
  let income = 0;
  let expense = 0;
  for (const tx of txs) {
    if (monthOf(tx.date) !== month) continue;
    if (tx.type === "income") income += tx.amount_cents;
    else if (tx.type === "expense") expense += tx.amount_cents;
  }
  return { income, expense, result: income - expense };
}

export type CategoryTotal = { category_id: string; total: number };

/**
 * Gasto (ou receita) por categoria no mês, do maior para o menor.
 * Agrupa só transações do tipo pedido; transferências nunca entram.
 */
export function categoryBreakdown(txs: Tx[], month: string, kind: "income" | "expense" = "expense"): CategoryTotal[] {
  const totals = new Map<string, number>();
  for (const tx of txs) {
    if (tx.type !== kind || monthOf(tx.date) !== month || !tx.category_id) continue;
    totals.set(tx.category_id, (totals.get(tx.category_id) ?? 0) + tx.amount_cents);
  }
  return [...totals.entries()]
    .map(([category_id, total]) => ({ category_id, total }))
    .sort((a, b) => b.total - a.total || a.category_id.localeCompare(b.category_id));
}

export type BudgetStatus = "ok" | "warning" | "exceeded";

export type BudgetUsage = {
  spent: number;
  limit: number;
  remaining: number;
  /** Fração consumida (1 = 100 %). `null` quando o limite é zero e nada foi gasto. */
  ratio: number | null;
  percent: number | null;
  status: BudgetStatus;
};

/**
 * Consumo do orçamento = despesas da categoria no mês ÷ limite.
 * `ok` abaixo de 80 %, `warning` de 80 % a 100 %, `exceeded` acima de 100 %.
 * Limite zero não divide por zero: sem gasto é `ok`; com gasto é `exceeded`.
 */
export function budgetUsage(spent: number, limit: number): BudgetUsage {
  const remaining = limit - spent;
  if (limit <= 0) {
    return { spent, limit, remaining, ratio: null, percent: null, status: spent > 0 ? "exceeded" : "ok" };
  }
  const ratio = spent / limit;
  // Comparação em inteiros para evitar erro de ponto flutuante nas fronteiras.
  let status: BudgetStatus;
  if (spent * 100 < limit * 80) status = "ok";
  else if (spent <= limit) status = "warning";
  else status = "exceeded";
  return { spent, limit, remaining, ratio, percent: Math.round(ratio * 1000) / 10, status };
}

export type Change = { a: number; b: number; diff: number; percent: number | null };

/**
 * Diferença de `b` em relação a `a` (b − a) e variação percentual.
 * Com `a` = 0 a variação percentual é indefinida (`null`), a não ser que `b` também seja 0 (0 %).
 */
export function compareValues(a: number, b: number): Change {
  const diff = b - a;
  if (a === 0) return { a, b, diff, percent: b === 0 ? 0 : null };
  return { a, b, diff, percent: Math.round((diff / Math.abs(a)) * 1000) / 10 };
}

export type PeriodComparison = {
  totals: { income: Change; expense: Change; result: Change };
  categories: Array<{ category_id: string } & Change>;
};

/** Compara dois meses: totais e gasto por categoria (despesas), ordenado pela maior diferença absoluta. */
export function comparePeriods(txs: Tx[], monthA: string, monthB: string): PeriodComparison {
  const ta = monthTotals(txs, monthA);
  const tb = monthTotals(txs, monthB);
  const ca = new Map(categoryBreakdown(txs, monthA).map((c) => [c.category_id, c.total]));
  const cb = new Map(categoryBreakdown(txs, monthB).map((c) => [c.category_id, c.total]));
  const ids = new Set([...ca.keys(), ...cb.keys()]);
  const categories = [...ids]
    .map((id) => ({ category_id: id, ...compareValues(ca.get(id) ?? 0, cb.get(id) ?? 0) }))
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff) || x.category_id.localeCompare(y.category_id));
  return {
    totals: {
      income: compareValues(ta.income, tb.income),
      expense: compareValues(ta.expense, tb.expense),
      result: compareValues(ta.result, tb.result),
    },
    categories,
  };
}
