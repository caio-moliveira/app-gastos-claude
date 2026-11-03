"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject, zodErrorToState, type FormState } from "@/lib/forms";
import { loginSchema, safeNextPath, signupSchema } from "@/lib/validation/auth";

function authErrorMessage(message: string | undefined): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (m.includes("already registered") || m.includes("already been registered"))
    return "Já existe uma conta com este e-mail.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (m.includes("rate limit")) return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (m.includes("password")) return "Senha inválida. Use pelo menos 8 caracteres.";
  return "Não foi possível autenticar. Tente novamente.";
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) return zodErrorToState(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error.message) };

  redirect(safeNextPath(raw.next));
}

export async function signupAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) return zodErrorToState(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { name: parsed.data.name } },
  });
  if (error) return { error: authErrorMessage(error.message) };
  if (!data.session) {
    // Projeto com confirmação de e-mail ativada (veja o README para desativar).
    return { success: "Conta criada. Confirme seu e-mail para entrar." };
  }

  redirect(safeNextPath(raw.next));
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
