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
  if (typeof value !== "string" || value.length > 2048) return "/";
  // Caracteres de controle e barra invertida são removidos/normalizados pelo parser de URL do navegador
  // ("/\t/evil.com" vira "//evil.com"), então são recusados de saída.
  if (!value.startsWith("/") || /[\x00-\x1F\x7F\\]/.test(value)) return "/";
  const base = "http://internal.invalid";
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    return "/";
  }
  if (url.origin !== base) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
