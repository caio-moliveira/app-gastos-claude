import { describe, expect, it } from "vitest";
import { lastMonths } from "@/lib/finance/dates";
import { generateMonth, stableUuid } from "./generator";

const months = lastMonths("2026-11", 13);

describe("gerador do seed", () => {
  it("é determinístico: mesmo espaço e mês geram exatamente as mesmas transações", () => {
    expect(generateMonth("casa", "2026-10", 123_45)).toEqual(generateMonth("casa", "2026-10", 123_45));
    expect(generateMonth("casa", "2026-10", 0).txs).not.toEqual(generateMonth("casa", "2026-09", 0).txs);
    expect(stableUuid("space:casa")).toBe(stableUuid("space:casa"));
    expect(stableUuid("space:casa")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("gera de 25 a 50 transações por mês por espaço, com ids únicos", () => {
    const ids = new Set<string>();
    for (const space of ["casa", "pessoal"] as const) {
      for (const month of months) {
        const { txs } = generateMonth(space, month, 50_000);
        expect(txs.length).toBeGreaterThanOrEqual(25);
        expect(txs.length).toBeLessThanOrEqual(50);
        for (const t of txs) ids.add(t.id);
      }
    }
    const total = months.length * 2;
    expect(ids.size).toBeGreaterThan(total * 25 - 1);
  });

  it("respeita o realismo do PRD §9", () => {
    for (const space of ["casa", "pessoal"] as const) {
      for (const month of months) {
        const { txs } = generateMonth(space, month, 50_000);
        const salary = txs.filter((t) => t.category === "Salário");
        expect(salary).toHaveLength(1);
        expect(salary[0].date).toBe(`${month}-05`);
        expect(salary[0].amount_cents).toBeGreaterThanOrEqual(400_000);
        expect(salary[0].amount_cents).toBeLessThanOrEqual(900_000);
        expect(txs.filter((t) => t.type === "transfer").length).toBeGreaterThanOrEqual(2);
        for (const t of txs) {
          expect(Number.isInteger(t.amount_cents)).toBe(true);
          expect(t.amount_cents).toBeGreaterThan(0);
          expect(t.date.startsWith(month)).toBe(true);
          if (t.type === "transfer") {
            expect(t.to_account).toBeDefined();
            expect(t.to_account).not.toBe(t.account);
            expect(t.category).toBeUndefined();
          }
          if (t.category === "Mercado") {
            expect(t.amount_cents).toBeGreaterThanOrEqual(8_000);
            expect(t.amount_cents).toBeLessThanOrEqual(45_000);
          }
        }
        if (space === "casa") {
          expect(txs.find((t) => t.description === "Aluguel apartamento")?.date).toBe(`${month}-10`);
        }
      }
    }
  });
});
