"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/form-message";
import { AmountInput } from "@/components/finance/amount-input";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { centsToInput } from "@/lib/finance/money";
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, type AccountType } from "@/lib/validation/finance";
import { saveAccountAction } from "../finance-actions";

type EditableAccount = { id: string; name: string; type: AccountType; initial_balance_cents: number };

export function AccountFormDialog({
  spaceId,
  account,
  trigger,
}: {
  spaceId: string;
  account?: EditableAccount;
  trigger: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setKey((k) => k + 1);
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{account ? "Editar conta" : "Nova conta"}</DialogTitle>
        </DialogHeader>
        <AccountForm key={key} spaceId={spaceId} account={account} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AccountForm({ spaceId, account, onDone }: { spaceId: string; account?: EditableAccount; onDone: () => void }) {
  const [state, action, pending] = useActionState(saveAccountAction, null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (state?.success) {
      toast.success(state.success);
      done.current();
    }
  }, [state]);

  const initial = account
    ? `${account.initial_balance_cents < 0 ? "-" : ""}${centsToInput(Math.abs(account.initial_balance_cents))}`
    : "";

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="spaceId" value={spaceId} />
      {account ? <input type="hidden" name="id" value={account.id} /> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="acc-name">Nome</Label>
        <Input id="acc-name" name="name" required maxLength={60} defaultValue={account?.name ?? ""} />
        <FieldError state={state} name="name" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="acc-type">Tipo</Label>
        <NativeSelect id="acc-type" name="type" defaultValue={account?.type ?? "checking"}>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t} value={t}>
              {ACCOUNT_TYPE_LABELS[t]}
            </option>
          ))}
        </NativeSelect>
        <FieldError state={state} name="type" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="acc-balance">Saldo inicial</Label>
        <AmountInput id="acc-balance" name="initialBalance" allowNegative defaultValue={initial} />
        <p className="text-xs text-muted-foreground">Use “−” para saldo devedor (ex.: cartão de crédito).</p>
        <FieldError state={state} name="initialBalance" />
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : account ? "Salvar" : "Criar conta"}
      </Button>
    </form>
  );
}
