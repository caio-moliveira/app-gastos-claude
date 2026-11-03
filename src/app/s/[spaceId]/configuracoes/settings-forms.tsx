"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { FieldError, FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteSpaceAction, renameSpaceAction } from "../space-actions";

export function RenameSpaceForm({ spaceId, name }: { spaceId: string; name: string }) {
  const [state, action, pending] = useActionState(renameSpaceAction, null);
  useEffect(() => {
    if (state?.success) toast.success(state.success);
  }, [state]);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nome</CardTitle>
        <CardDescription>Visível para todos os membros.</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="flex flex-col gap-1.5">
          <input type="hidden" name="spaceId" value={spaceId} />
          <Label htmlFor="space-name">Nome do espaço</Label>
          <Input id="space-name" name="name" defaultValue={name} required maxLength={60} />
          <FieldError state={state} name="name" />
          {state?.error && !state.fieldErrors ? <FormMessage state={state} /> : null}
        </CardContent>
        <CardFooter className="mt-4">
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function DeleteSpaceForm({ spaceId, name }: { spaceId: string; name: string }) {
  const [state, action, pending] = useActionState(deleteSpaceAction, null);
  const [open, setOpen] = useState(false);
  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="text-destructive">Excluir espaço</CardTitle>
        <CardDescription>
          Apaga o espaço e todos os dados dele (contas, transações, orçamentos e conversas). Não pode ser desfeito.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger render={<Button variant="destructive" />}>Excluir espaço</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Excluir “{name}”?</DialogTitle>
              <DialogDescription>Digite o nome do espaço para confirmar a exclusão definitiva.</DialogDescription>
            </DialogHeader>
            <form action={action} className="flex flex-col gap-3">
              <input type="hidden" name="spaceId" value={spaceId} />
              <Label htmlFor="confirm">Nome do espaço</Label>
              <Input id="confirm" name="confirm" autoComplete="off" required />
              <FieldError state={state} name="confirm" />
              <FormMessage state={state?.fieldErrors ? null : state} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" variant="destructive" disabled={pending}>
                  {pending ? "Excluindo..." : "Excluir definitivamente"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardFooter>
    </Card>
  );
}
