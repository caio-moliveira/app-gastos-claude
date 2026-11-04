"use client";

import { useActionState, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FormState } from "@/lib/forms";

type Props = {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  fields: Record<string, string>;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  trigger: React.ReactElement;
  destructive?: boolean;
  children?: ReactNode;
};

/** Botão que abre uma confirmação e envia uma Server Action com campos ocultos. */
export function ConfirmAction({ action, fields, title, description, confirmLabel, trigger, destructive = true, children }: Props) {
  const [open, setOpen] = useState(false);
  const [, formAction, pending] = useActionState(async (prev: FormState, formData: FormData) => {
    const result = await action(prev, formData);
    if (result?.success) {
      toast.success(result.success);
      setOpen(false);
    } else if (result?.error) {
      toast.error(result.error);
    }
    return result;
  }, null);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant={destructive ? "destructive" : "default"} disabled={pending}>
              {pending ? "Aguarde..." : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
