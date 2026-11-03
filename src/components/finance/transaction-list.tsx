import { ArrowLeftRight, Pencil, Trash2 } from "lucide-react";
import { deleteTransactionAction } from "@/app/s/[spaceId]/finance-actions";
import { ConfirmAction } from "@/components/confirm-action";
import { Button } from "@/components/ui/button";
import type { Account, Category, TransactionRow } from "@/lib/data/finance";
import { formatDateBR } from "@/lib/finance/dates";
import { formatBRL } from "@/lib/finance/money";
import { cn } from "@/lib/utils";
import { TransactionFormDialog } from "./transaction-form-dialog";

type Props = {
  spaceId: string;
  rows: TransactionRow[];
  accounts: Account[];
  categories: Category[];
  canEdit: boolean;
  emptyMessage?: string;
};

/** Lista responsiva de transações (uma linha por item; ações só para quem edita). */
export function TransactionList({ spaceId, rows, accounts, categories, canEdit, emptyMessage }: Props) {
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        {emptyMessage ?? "Nenhuma transação encontrada."}
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border" data-testid="transaction-list">
      {rows.map((tx) => {
        const category = tx.category_id ? categoryById.get(tx.category_id) : undefined;
        const isTransfer = tx.type === "transfer";
        const sign = tx.type === "income" ? "+" : tx.type === "expense" ? "−" : "";
        return (
          <li key={tx.id} className="flex items-center gap-3 px-3 py-2.5" data-testid="transaction-row">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: category ? `${category.color}22` : undefined }}
              aria-hidden
            >
              {isTransfer ? (
                <ArrowLeftRight className="size-4 text-muted-foreground" />
              ) : (
                <span className="size-2.5 rounded-full" style={{ backgroundColor: category?.color ?? "#64748b" }} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{tx.description}</p>
              <p className="truncate text-xs text-muted-foreground">
                {formatDateBR(tx.date)} ·{" "}
                {isTransfer
                  ? `${accountName.get(tx.account_id) ?? "?"} → ${accountName.get(tx.transfer_to_account_id ?? "") ?? "?"}`
                  : `${category?.name ?? "Sem categoria"} · ${accountName.get(tx.account_id) ?? "?"}`}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 text-sm font-semibold tabular-nums",
                tx.type === "income" && "text-emerald-600 dark:text-emerald-400",
                tx.type === "expense" && "text-rose-600 dark:text-rose-400",
                isTransfer && "text-muted-foreground",
              )}
              data-testid="transaction-amount"
            >
              {sign}
              {formatBRL(tx.amount_cents)}
            </span>
            {canEdit ? (
              <div className="flex shrink-0 items-center">
                <TransactionFormDialog
                  spaceId={spaceId}
                  accounts={accounts}
                  categories={categories}
                  transaction={tx}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Editar ${tx.description}`}>
                      <Pencil className="size-4" />
                    </Button>
                  }
                />
                <ConfirmAction
                  action={deleteTransactionAction}
                  fields={{ spaceId, id: tx.id }}
                  title="Excluir transação?"
                  description={`“${tx.description}” de ${formatBRL(tx.amount_cents)} será excluída.`}
                  confirmLabel="Excluir"
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Excluir ${tx.description}`}>
                      <Trash2 className="size-4" />
                    </Button>
                  }
                />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
