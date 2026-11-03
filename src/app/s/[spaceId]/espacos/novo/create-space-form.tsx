"use client";

import { useActionState } from "react";
import { FieldError, FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/native-select";
import { createSpaceAction } from "../../space-actions";

export function CreateSpaceForm() {
  const [state, action, pending] = useActionState(createSpaceAction, null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo espaço</CardTitle>
        <CardDescription>Espaços isolam contas, transações e orçamentos.</CardDescription>
      </CardHeader>
      <form action={action}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" required maxLength={60} placeholder="Ex.: Casa" />
            <FieldError state={state} name="name" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="type">Tipo</Label>
            <NativeSelect id="type" name="type" defaultValue="shared">
              <option value="individual">Individual</option>
              <option value="shared">Compartilhado</option>
            </NativeSelect>
            <FieldError state={state} name="type" />
          </div>
          <FormMessage state={state} />
        </CardContent>
        <CardFooter className="mt-4">
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Criando..." : "Criar espaço"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
