import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254, "E-mail muito longo."),
  password: z.string().min(1, "Informe a senha.").max(128, "Senha muito longa."),
});

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Informe seu nome.").max(120, "Nome muito longo."),
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254, "E-mail muito longo."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres.").max(128, "Senha muito longa."),
});

/** Só aceita caminhos internos para evitar open redirect no `?next=`. */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value;
}
