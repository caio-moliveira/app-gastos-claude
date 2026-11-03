import { z } from "zod";
import { isIsoDate } from "@/lib/finance/dates";
import { parseAmountToCents } from "@/lib/finance/money";
import { uuidSchema } from "./spaces";

export const ACCOUNT_TYPES = ["checking", "savings", "credit_card", "cash", "investment"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  credit_card: "Cartão de crédito",
  cash: "Dinheiro",
  investment: "Investimento",
};

export const TX_TYPES = ["income", "expense", "transfer"] as const;
export type TransactionType = (typeof TX_TYPES)[number];
export const TX_TYPE_LABELS: Record<TransactionType, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
};

export const CATEGORY_KINDS = ["income", "expense"] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];
export const CATEGORY_KIND_LABELS: Record<CategoryKind, string> = { income: "Receita", expense: "Despesa" };

/** Valor positivo digitado em reais ("1.234,56") → centavos. */
export const amountSchema = z.string().transform((value, ctx) => {
  const parsed = parseAmountToCents(value);
  if (!parsed.ok) {
    ctx.addIssue({ code: "custom", message: parsed.error });
    return z.NEVER;
  }
  return parsed.cents;
});

/** Saldo inicial: pode ser zero ou negativo (cartão de crédito). */
export const signedAmountSchema = z.string().transform((value, ctx) => {
  const trimmed = (value ?? "").trim();
  if (trimmed === "" || /^-?\s*(R\$)?\s*0+([.,]0+)?$/i.test(trimmed)) return 0;
  const negative = trimmed.startsWith("-");
  const parsed = parseAmountToCents(negative ? trimmed.slice(1) : trimmed);
  if (!parsed.ok) {
    ctx.addIssue({ code: "custom", message: parsed.error === "O valor deve ser maior que zero." ? "Valor inválido." : parsed.error });
    return z.NEVER;
  }
  return negative ? -parsed.cents : parsed.cents;
});

export const isoDateSchema = z.string().refine(isIsoDate, "Data inválida.");

const optionalUuid = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(uuidSchema.nullable());

export const transactionSchema = z
  .object({
    spaceId: uuidSchema,
    type: z.enum(TX_TYPES, { message: "Tipo de transação inválido." }),
    amount: amountSchema,
    date: isoDateSchema,
    accountId: z.string().uuid("Selecione a conta."),
    categoryId: optionalUuid,
    transferToAccountId: optionalUuid,
    description: z.string().trim().min(1, "Informe a descrição.").max(120, "Descrição muito longa (máx. 120)."),
    notes: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() ? v.trim() : null))
      .pipe(z.string().max(1000, "Observações muito longas (máx. 1000).").nullable()),
  })
  .superRefine((tx, ctx) => {
    if (tx.type === "transfer") {
      if (!tx.transferToAccountId) ctx.addIssue({ code: "custom", path: ["transferToAccountId"], message: "Selecione a conta de destino." });
      else if (tx.transferToAccountId === tx.accountId)
        ctx.addIssue({ code: "custom", path: ["transferToAccountId"], message: "A conta de destino deve ser diferente da origem." });
    } else if (!tx.categoryId) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "Selecione a categoria." });
    }
  })
  .transform((tx) => ({
    ...tx,
    categoryId: tx.type === "transfer" ? null : tx.categoryId,
    transferToAccountId: tx.type === "transfer" ? tx.transferToAccountId : null,
  }));

export type TransactionInput = z.output<typeof transactionSchema>;

export type RefAccount = { id: string; space_id: string };
export type RefCategory = { id: string; space_id: string; kind: CategoryKind };

/**
 * Confere se conta, destino e categoria pertencem ao espaço da transação (e se a categoria
 * tem o tipo certo). O banco garante o mesmo por FK composta + trigger; isto dá a mensagem amigável.
 */
export function checkTransactionRefs(
  tx: Pick<TransactionInput, "spaceId" | "type" | "accountId" | "categoryId" | "transferToAccountId">,
  accounts: RefAccount[],
  categories: RefCategory[],
): { ok: true } | { ok: false; field: string; error: string } {
  const account = accounts.find((a) => a.id === tx.accountId);
  if (!account || account.space_id !== tx.spaceId) return { ok: false, field: "accountId", error: "Conta inválida para este espaço." };
  if (tx.type === "transfer") {
    const dest = accounts.find((a) => a.id === tx.transferToAccountId);
    if (!dest || dest.space_id !== tx.spaceId)
      return { ok: false, field: "transferToAccountId", error: "Conta de destino inválida para este espaço." };
    return { ok: true };
  }
  const category = categories.find((c) => c.id === tx.categoryId);
  if (!category || category.space_id !== tx.spaceId)
    return { ok: false, field: "categoryId", error: "Categoria inválida para este espaço." };
  if (category.kind !== tx.type) return { ok: false, field: "categoryId", error: "A categoria não corresponde ao tipo da transação." };
  return { ok: true };
}

export const accountSchema = z.object({
  spaceId: uuidSchema,
  name: z.string().trim().min(1, "Informe o nome da conta.").max(60, "Nome muito longo (máx. 60)."),
  type: z.enum(ACCOUNT_TYPES, { message: "Tipo de conta inválido." }),
  initialBalance: signedAmountSchema,
});

export const categorySchema = z.object({
  spaceId: uuidSchema,
  name: z.string().trim().min(1, "Informe o nome da categoria.").max(40, "Nome muito longo (máx. 40)."),
  kind: z.enum(CATEGORY_KINDS, { message: "Tipo de categoria inválido." }),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida."),
});
