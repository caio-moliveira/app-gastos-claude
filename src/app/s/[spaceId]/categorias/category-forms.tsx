"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { FieldError } from "@/components/form-message";
import { NativeSelect } from "@/components/native-select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_KINDS, CATEGORY_KIND_LABELS, type CategoryKind } from "@/lib/validation/finance";
import { saveCategoryAction } from "../finance-actions";

type EditableCategory = { id: string; name: string; kind: CategoryKind; color: string };

export function CategoryFormDialog({
  spaceId,
  category,
  defaultKind = "expense",
  kindLocked = false,
  trigger,
}: {
  spaceId: string;
  category?: EditableCategory;
  defaultKind?: CategoryKind;
  /** Categoria em uso não muda de tipo (o banco também impede). */
  kindLocked?: boolean;
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
          <DialogTitle>{category ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <CategoryForm
          key={key}
          spaceId={spaceId}
          category={category}
          defaultKind={defaultKind}
          kindLocked={kindLocked}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  spaceId,
  category,
  defaultKind,
  kindLocked,
  onDone,
}: {
  spaceId: string;
  category?: EditableCategory;
  defaultKind: CategoryKind;
  kindLocked: boolean;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveCategoryAction, null);
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

  const kind = category?.kind ?? defaultKind;
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="spaceId" value={spaceId} />
      {category ? <input type="hidden" name="id" value={category.id} /> : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cat-name">Nome</Label>
        <Input id="cat-name" name="name" required maxLength={40} defaultValue={category?.name ?? ""} />
        <FieldError state={state} name="name" />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-kind">Tipo</Label>
          {kindLocked ? <input type="hidden" name="kind" value={kind} /> : null}
          <NativeSelect id="cat-kind" name={kindLocked ? undefined : "kind"} defaultValue={kind} disabled={kindLocked}>
            {CATEGORY_KINDS.map((k) => (
              <option key={k} value={k}>
                {CATEGORY_KIND_LABELS[k]}
              </option>
            ))}
          </NativeSelect>
          <FieldError state={state} name="kind" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cat-color">Cor</Label>
          <Input id="cat-color" name="color" type="color" className="h-8 w-14 p-1" defaultValue={category?.color ?? "#64748b"} />
        </div>
      </div>
      {state?.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Salvando..." : category ? "Salvar" : "Criar categoria"}
      </Button>
    </form>
  );
}

/** Seletor de destino exibido no diálogo de exclusão quando a categoria está em uso. */
export function MoveTargetSelect({ options }: { options: Array<{ id: string; name: string }> }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="move-to">Mover as transações para</Label>
      <NativeSelect id="move-to" name="moveTo" required defaultValue={options[0]?.id ?? ""}>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
