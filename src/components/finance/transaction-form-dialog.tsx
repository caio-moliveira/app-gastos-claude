"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { saveTransactionAction } from "@/app/s/[spaceId]/finance-actions";
import { FieldError } from "@/components/form-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { todayISO } from "@/lib/finance/dates";
import { centsToInput } from "@/lib/finance/money";
import { cn } from "@/lib/utils";
import { TX_TYPE_LABELS, TX_TYPES, type TransactionType } from "@/lib/validation/finance";
import { AmountInput } from "./amount-input";

export type FormAccount = { id: string; name: string; archived: boolean };
export type FormCategory = { id: string; name: string; kind: "income" | "expense" };
export type EditableTransaction = {
  id: string;
  type: TransactionType;
  amount_cents: number;
  date: string;
  account_id: string;
  category_id: string | null;
  transfer_to_account_id: string | null;
  description: string;
  notes: string | null;
};

type Props = {
  spaceId: string;
  accounts: FormAccount[];
  categories: FormCategory[];
  transaction?: EditableTransaction;
  trigger: React.ReactElement;
};

export function TransactionFormDialog({ spaceId, accounts, categories, transaction, trigger }: Props) {
  const [open, setOpen] = useState(false);
  // Remonta o formulário a cada abertura para começar limpo.
  const [formKey, setFormKey] = useState(0);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setFormKey((k) => k + 1);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{transaction ? "Editar transação" : "Nova transação"}</DialogTitle>
          <DialogDescription>Valores em reais; a data padrão é hoje.</DialogDescription>
        </DialogHeader>
        <TransactionForm
          key={formKey}
          spaceId={spaceId}
          accounts={accounts}
          categories={categories}
          transaction={transaction}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function TransactionForm({
  spaceId,
  accounts,
  categories,
  transaction,
  onDone,
}: Omit<Props, "trigger"> & { onDone: () => void }) {
  const [state, action, pending] = useActionState(saveTransactionAction, null);
  const [type, setType] = useState<TransactionType>(transaction?.type ?? "expense");

  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  });
  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      onDoneRef.current();
    }
  }, [state]);

  // Contas arquivadas só aparecem se já forem as da transação editada.
  const usableAccounts = accounts.filter(
    (a) => !a.archived || a.id === transaction?.account_id || a.id === transaction?.transfer_to_account_id,
  );
  const kindCategories = categories.filter((c) => c.kind === (type === "income" ? "income" : "expense"));
  const defaultCategory =
    transaction && transaction.type === type ? (transaction.category_id ?? "") : "";

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="spaceId" value={spaceId} />
      {transaction ? <input type="hidden" name="id" value={transaction.id} /> : null}
      <input type="hidden" name="type" value={type} />

      <div role="radiogroup" aria-label="Tipo" className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
        {TX_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={type === t}
            onClick={() => setType(t)}
            className={cn(
              "h-8 rounded-md text-sm font-medium text-muted-foreground transition-colors",
              type === t && "bg-background text-foreground shadow-sm",
            )}
          >
            {TX_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tx-amount">Valor</Label>
          <AmountInput
            id="tx-amount"
            name="amount"
            required
            defaultValue={transaction ? centsToInput(transaction.amount_cents) : ""}
            aria-invalid={Boolean(state?.fieldErrors?.amount)}
          />
          <FieldError state={state} name="amount" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tx-date">Data</Label>
          <Input id="tx-date" name="date" type="date" required defaultValue={transaction?.date ?? todayISO()} />
          <FieldError state={state} name="date" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="tx-account">{type === "transfer" ? "Conta de origem" : "Conta"}</Label>
          <NativeSelect id="tx-account" name="accountId" required defaultValue={transaction?.account_id ?? usableAccounts[0]?.id ?? ""}>
            {usableAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.archived ? " (arquivada)" : ""}
              </option>
            ))}
          </NativeSelect>
          <FieldError state={state} name="accountId" />
        </div>

        {type === "transfer" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-dest">Conta de destino</Label>
            <NativeSelect
              id="tx-dest"
              name="transferToAccountId"
              required
              defaultValue={transaction?.transfer_to_account_id ?? usableAccounts[1]?.id ?? ""}
            >
              <option value="">Selecione</option>
              {usableAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </NativeSelect>
            <FieldError state={state} name="transferToAccountId" />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tx-category">Categoria</Label>
            <NativeSelect key={type} id="tx-category" name="categoryId" required defaultValue={defaultCategory}>
              <option value="">Selecione</option>
              {kindCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </NativeSelect>
            <FieldError state={state} name="categoryId" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-description">Descrição</Label>
        <Input id="tx-description" name="description" required maxLength={120} defaultValue={transaction?.description ?? ""} />
        <FieldError state={state} name="description" />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tx-notes">Observações</Label>
        <Textarea id="tx-notes" name="notes" maxLength={1000} rows={2} defaultValue={transaction?.notes ?? ""} />
        <FieldError state={state} name="notes" />
      </div>

      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" disabled={pending || usableAccounts.length === 0}>
        {pending ? "Salvando..." : transaction ? "Salvar alterações" : "Adicionar transação"}
      </Button>
      {usableAccounts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Crie uma conta antes de lançar transações.</p>
      ) : null}
    </form>
  );
}
