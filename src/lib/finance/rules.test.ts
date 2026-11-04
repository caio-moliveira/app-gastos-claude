import { describe, expect, it } from "vitest";
import {
  accountBalance,
  budgetUsage,
  categoryBreakdown,
  compareValues,
  comparePeriods,
  monthTotals,
  spaceTotalBalance,
  type Tx,
} from "./rules";

const CC = "conta-corrente";
const POUP = "poupanca";
const CARD = "cartao";

function tx(partial: Partial<Tx> & Pick<Tx, "type" | "amount_cents" | "date">): Tx {
  return {
    account_id: CC,
    transfer_to_account_id: null,
    category_id: partial.type === "transfer" ? null : "cat-outros",
    ...partial,
  };
}

const txs: Tx[] = [
  tx({ type: "income", amount_cents: 500_000, date: "2026-10-05", category_id: "salario" }),
  tx({ type: "expense", amount_cents: 25_000, date: "2026-10-07", category_id: "mercado" }),
  tx({ type: "expense", amount_cents: 12_050, date: "2026-10-09", category_id: "mercado" }),
  tx({ type: "expense", amount_cents: 80_000, date: "2026-10-10", category_id: "moradia" }),
  // Transferência enviada da conta corrente para a poupança.
  tx({ type: "transfer", amount_cents: 100_000, date: "2026-10-06", transfer_to_account_id: POUP }),
  // Transferência recebida pela conta corrente (vinda do cartão, só para cobrir o outro sentido).
  tx({ type: "transfer", amount_cents: 3_000, date: "2026-10-20", account_id: CARD, transfer_to_account_id: CC }),
  // Mês seguinte.
  tx({ type: "expense", amount_cents: 7_000, date: "2026-11-02", category_id: "mercado" }),
  // Despesa em outra conta.
  tx({ type: "expense", amount_cents: 9_990, date: "2026-10-15", account_id: CARD, category_id: "lazer" }),
];

describe("saldo de conta", () => {
  it("saldo com saldo inicial, receitas, despesas e transferências nos dois sentidos", () => {
    const conta = { id: CC, initial_balance_cents: 100_000, archived: false };
    // 1.000 + 5.000 − 250 − 120,50 − 800 − 1.000 (enviada) + 30 (recebida) − 70 (nov)
    expect(accountBalance(conta, txs)).toBe(100_000 + 500_000 - 25_000 - 12_050 - 80_000 - 100_000 + 3_000 - 7_000);
    expect(accountBalance({ id: POUP, initial_balance_cents: 0, archived: false }, txs)).toBe(100_000);
    expect(accountBalance({ id: CARD, initial_balance_cents: 0, archived: false }, txs)).toBe(-3_000 - 9_990);
  });

  it("saldo de conta em uma data passada ignora transações posteriores", () => {
    const conta = { id: CC, initial_balance_cents: 100_000, archived: false };
    expect(accountBalance(conta, txs, "2026-10-06")).toBe(100_000 + 500_000 - 100_000);
    expect(accountBalance(conta, txs, "2026-10-04")).toBe(100_000);
    // A data de referência é inclusiva.
    expect(accountBalance(conta, txs, "2026-10-31")).toBe(100_000 + 500_000 - 25_000 - 12_050 - 80_000 - 100_000 + 3_000);
  });

  it("cria conta com saldo inicial de R$ 1.000, lança despesa de R$ 250 e vê saldo R$ 750 (aceite §6.3)", () => {
    const conta = { id: "nova", initial_balance_cents: 100_000, archived: false };
    const despesa = tx({ type: "expense", amount_cents: 25_000, date: "2026-11-01", account_id: "nova" });
    expect(accountBalance(conta, [despesa])).toBe(75_000);
  });

  it("saldo total do espaço soma só as contas não arquivadas", () => {
    const accounts = [
      { id: CC, initial_balance_cents: 0, archived: false },
      { id: POUP, initial_balance_cents: 0, archived: false },
      { id: CARD, initial_balance_cents: 0, archived: true },
    ];
    const total = spaceTotalBalance(accounts, txs);
    expect(total).toBe(accountBalance(accounts[0], txs) + accountBalance(accounts[1], txs));
    // Transferências entre contas ativas não alteram o total.
    const onlyTransfer = [tx({ type: "transfer", amount_cents: 5_000, date: "2026-10-01", transfer_to_account_id: POUP })];
    expect(spaceTotalBalance(accounts.slice(0, 2), onlyTransfer)).toBe(0);
  });
});

describe("totais do mês", () => {
  it("receita e despesa do mês excluem transferências", () => {
    expect(monthTotals(txs, "2026-10")).toEqual({
      income: 500_000,
      expense: 25_000 + 12_050 + 80_000 + 9_990,
      result: 500_000 - (25_000 + 12_050 + 80_000 + 9_990),
    });
    expect(monthTotals(txs, "2026-11")).toEqual({ income: 0, expense: 7_000, result: -7_000 });
    expect(monthTotals([tx({ type: "transfer", amount_cents: 1, date: "2026-10-01", transfer_to_account_id: POUP })], "2026-10")).toEqual({
      income: 0,
      expense: 0,
      result: 0,
    });
  });

  it("gasto por categoria agrupa só despesas do mês e ordena do maior para o menor", () => {
    expect(categoryBreakdown(txs, "2026-10")).toEqual([
      { category_id: "moradia", total: 80_000 },
      { category_id: "mercado", total: 37_050 },
      { category_id: "lazer", total: 9_990 },
    ]);
    expect(categoryBreakdown(txs, "2026-10", "income")).toEqual([{ category_id: "salario", total: 500_000 }]);
  });
});

describe("orçamento", () => {
  it("consumo de orçamento em 0 %, 79 %, 80 %, 100 % e 101 % devolve o status correto", () => {
    expect(budgetUsage(0, 10_000).status).toBe("ok");
    expect(budgetUsage(7_900, 10_000).status).toBe("ok");
    expect(budgetUsage(8_000, 10_000).status).toBe("warning");
    expect(budgetUsage(10_000, 10_000).status).toBe("warning");
    expect(budgetUsage(10_100, 10_000).status).toBe("exceeded");
    expect(budgetUsage(7_999, 10_000).status).toBe("ok");
    expect(budgetUsage(8_000, 10_000).percent).toBe(80);
    expect(budgetUsage(10_100, 10_000).remaining).toBe(-100);
  });

  it("limite zero não divide por zero", () => {
    const empty = budgetUsage(0, 0);
    expect(empty.ratio).toBeNull();
    expect(empty.status).toBe("ok");
    const spent = budgetUsage(500, 0);
    expect(spent.ratio).toBeNull();
    expect(spent.status).toBe("exceeded");
    expect(Number.isFinite(spent.remaining)).toBe(true);
  });
});

describe("comparação entre meses", () => {
  it("comparação entre meses devolve diferença absoluta e percentual, tratando mês anterior com zero", () => {
    expect(compareValues(10_000, 15_000)).toEqual({ a: 10_000, b: 15_000, diff: 5_000, percent: 50 });
    expect(compareValues(10_000, 7_500)).toEqual({ a: 10_000, b: 7_500, diff: -2_500, percent: -25 });
    expect(compareValues(0, 5_000)).toEqual({ a: 0, b: 5_000, diff: 5_000, percent: null });
    expect(compareValues(0, 0)).toEqual({ a: 0, b: 0, diff: 0, percent: 0 });
    // Resultado negativo no mês anterior: variação relativa ao valor absoluto.
    expect(compareValues(-1_000, 1_000).percent).toBe(200);

    const cmp = comparePeriods(txs, "2026-10", "2026-11");
    expect(cmp.totals.expense).toEqual({ a: 127_040, b: 7_000, diff: -120_040, percent: -94.5 });
    expect(cmp.categories[0]).toEqual({ category_id: "moradia", a: 80_000, b: 0, diff: -80_000, percent: -100 });
    const mercado = cmp.categories.find((c) => c.category_id === "mercado");
    expect(mercado).toEqual({ category_id: "mercado", a: 37_050, b: 7_000, diff: -30_050, percent: -81.1 });
  });
});
