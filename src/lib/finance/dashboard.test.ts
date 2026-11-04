import { describe, expect, it } from "vitest";
import { buildDashboard, formatPercentChange } from "./dashboard";
import type { Tx } from "./rules";

const acc = [
  { id: "cc", initial_balance_cents: 100_000, archived: false },
  { id: "old", initial_balance_cents: 999_999, archived: true },
];
const ledger: Tx[] = [
  { account_id: "cc", transfer_to_account_id: null, category_id: "sal", type: "income", amount_cents: 400_000, date: "2026-09-05" },
  { account_id: "cc", transfer_to_account_id: null, category_id: "mer", type: "expense", amount_cents: 100_000, date: "2026-09-10" },
  { account_id: "cc", transfer_to_account_id: null, category_id: "sal", type: "income", amount_cents: 500_000, date: "2026-10-05" },
  { account_id: "cc", transfer_to_account_id: null, category_id: "mer", type: "expense", amount_cents: 150_000, date: "2026-10-12" },
  { account_id: "cc", transfer_to_account_id: null, category_id: "laz", type: "expense", amount_cents: 50_000, date: "2026-10-20" },
  { account_id: "cc", transfer_to_account_id: null, category_id: "mer", type: "expense", amount_cents: 10_000, date: "2026-11-02" },
];

describe("painel", () => {
  it("cards do mês: saldo no fim do mês, totais e variação contra o mês anterior", () => {
    const d = buildDashboard(acc, ledger, "2026-10", "2026-11-03");
    expect(d.balanceAsOf).toBe("2026-10-31");
    expect(d.balance).toBe(100_000 + 400_000 - 100_000 + 500_000 - 150_000 - 50_000);
    expect([d.income, d.expense, d.result]).toEqual([500_000, 200_000, 300_000]);
    expect(d.vsPrevious.result).toEqual({ a: 300_000, b: 300_000, diff: 0, percent: 0 });
    expect(d.vsPrevious.expense.percent).toBe(100);
    expect(d.byCategory).toEqual([
      { category_id: "mer", total: 150_000 },
      { category_id: "laz", total: 50_000 },
    ]);
  });

  it("mês atual usa o saldo de hoje e a evolução cobre 6 meses terminando no mês", () => {
    const d = buildDashboard(acc, ledger, "2026-11", "2026-11-03");
    expect(d.balanceAsOf).toBe("2026-11-03");
    expect(d.trend.map((t) => t.month)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(d.trend.at(-2)).toEqual({ month: "2026-10", label: "out/26", income: 500_000, expense: 200_000 });
  });

  it("formata a variação percentual", () => {
    expect(formatPercentChange(12.34)).toBe("+12,3 %");
    expect(formatPercentChange(-4)).toBe("−4 %");
    expect(formatPercentChange(0)).toBe("0 %");
    expect(formatPercentChange(null)).toBe("—");
  });
});
