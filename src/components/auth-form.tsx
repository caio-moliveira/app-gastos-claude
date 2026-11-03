"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormMessage } from "@/components/form-message";
import type { FormState } from "@/lib/forms";

type Props = {
  mode: "login" | "signup";
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  next?: string;
};

export function AuthForm({ mode, action, next }: Props) {
  const [state, formAction, pending] = useActionState(action, null);
  const isLogin = mode === "login";
  const query = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-xl">{isLogin ? "Entrar no Cofre" : "Criar conta"}</CardTitle>
        <CardDescription>
          {isLogin ? "Use seu e-mail e senha." : "Seu espaço Pessoal é criado automaticamente."}
        </CardDescription>
      </CardHeader>
      <form action={formAction}>
        <CardContent className="flex flex-col gap-4">
          {next ? <input type="hidden" name="next" value={next} /> : null}
          {!isLogin && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" name="name" autoComplete="name" required maxLength={120} />
              <FieldError state={state} name="name" />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
            <FieldError state={state} name="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              minLength={isLogin ? 1 : 8}
              maxLength={128}
            />
            <FieldError state={state} name="password" />
          </div>
          <FormMessage state={state} />
        </CardContent>
        <CardFooter className="mt-4 flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"}
          </Button>
          <p className="text-sm text-muted-foreground">
            {isLogin ? "Ainda não tem conta? " : "Já tem conta? "}
            <Link href={`${isLogin ? "/cadastro" : "/login"}${query}`} className="text-primary underline-offset-4 hover:underline">
              {isLogin ? "Cadastre-se" : "Entrar"}
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
