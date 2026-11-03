import { describe, expect, it } from "vitest";
import { accountSchema, checkTransactionRefs, transactionSchema } from "./finance";

const SPACE = "11111111-1111-4111-8111-111111111111";
const OTHER_SPACE = "22222222-2222-4222-8222-222222222222";
const ACC = "33333333-3333-4333-8333-333333333333";
const ACC2 = "44444444-4444-4444-8444-444444444444";
const FOREIGN_ACC = "55555555-5555-4555-8555-555555555555";
const CAT_EXP = "66666666-6666-4666-8666-666666666666";
const CAT_INC = "77777777-7777-4777-8777-777777777777";

const accounts = [
  { id: ACC, space_id: SPACE },
  { id: ACC2, space_id: SPACE },
  { id: FOREIGN_ACC, space_id: OTHER_SPACE },
];
const categories = [
  { id: CAT_EXP, space_id: SPACE, kind: "expense" as const },
  { id: CAT_INC, space_id: SPACE, kind: "income" as const },
];

function base(overrides: Record<string, string> = {}) {
  return {
    spaceId: SPACE,
    type: "expense",
    amount: "250,00",
    date: "2026-10-07",
    accountId: ACC,
    categoryId: CAT_EXP,
    transferToAccountId: "",
    description: "Supermercado Bom Preço",
    notes: "",
    ...overrides,
  };
}

describe("validação de transação", () => {
  it("aceita despesa válida e converte valor para centavos", () => {
    const parsed = transactionSchema.safeParse(base());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.amount).toBe(25_000);
      expect(parsed.data.transferToAccountId).toBeNull();
      expect(parsed.data.notes).toBeNull();
    }
  });

  it("rejeita valor zero, negativo, data inválida e descrição vazia", () => {
    expect(transactionSchema.safeParse(base({ amount: "0" })).success).toBe(false);
    expect(transactionSchema.safeParse(base({ amount: "-10" })).success).toBe(false);
    expect(transactionSchema.safeParse(base({ date: "2026-02-30" })).success).toBe(false);
    expect(transactionSchema.safeParse(base({ description: "  " })).success).toBe(false);
    expect(transactionSchema.safeParse(base({ type: "loan" })).success).toBe(false);
    expect(transactionSchema.safeParse(base({ categoryId: "" })).success).toBe(false);
  });

  it("transferência exige destino diferente da origem e descarta categoria", () => {
    expect(transactionSchema.safeParse(base({ type: "transfer", transferToAccountId: "" })).success).toBe(false);
    expect(transactionSchema.safeParse(base({ type: "transfer", transferToAccountId: ACC })).success).toBe(false);
    const ok = transactionSchema.safeParse(base({ type: "transfer", transferToAccountId: ACC2 }));
    expect(ok.success && ok.data.categoryId).toBeNull();
  });

  it("transação com conta de outro espaço é rejeitada pela validação", () => {
    const parsed = transactionSchema.parse(base({ accountId: FOREIGN_ACC }));
    expect(checkTransactionRefs(parsed, accounts, categories)).toEqual({
      ok: false,
      field: "accountId",
      error: "Conta inválida para este espaço.",
    });

    const transfer = transactionSchema.parse(base({ type: "transfer", transferToAccountId: FOREIGN_ACC }));
    expect(checkTransactionRefs(transfer, accounts, categories).ok).toBe(false);
  });

  it("categoria precisa ter o mesmo tipo da transação", () => {
    const parsed = transactionSchema.parse(base({ categoryId: CAT_INC }));
    expect(checkTransactionRefs(parsed, accounts, categories).ok).toBe(false);
    expect(checkTransactionRefs(transactionSchema.parse(base()), accounts, categories)).toEqual({ ok: true });
  });
});

describe("validação de conta", () => {
  it("saldo inicial aceita zero e negativo", () => {
    expect(accountSchema.parse({ spaceId: SPACE, name: "Cartão", type: "credit_card", initialBalance: "-1.500,00" }).initialBalance).toBe(-150_000);
    expect(accountSchema.parse({ spaceId: SPACE, name: "Carteira", type: "cash", initialBalance: "" }).initialBalance).toBe(0);
    expect(accountSchema.parse({ spaceId: SPACE, name: "Corrente", type: "checking", initialBalance: "1.000" }).initialBalance).toBe(100_000);
    expect(accountSchema.safeParse({ spaceId: SPACE, name: "X", type: "checking", initialBalance: "abc" }).success).toBe(false);
    expect(accountSchema.safeParse({ spaceId: SPACE, name: "X", type: "loan", initialBalance: "0" }).success).toBe(false);
  });
});
