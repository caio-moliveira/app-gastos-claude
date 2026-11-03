import type { z } from "zod";

/** Estado devolvido pelas Server Actions de formulário (useActionState). */
export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
} | null;

export function formDataToObject(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/** Converte um erro do zod no estado de formulário (primeira mensagem por campo). */
export function zodErrorToState(error: z.ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: error.issues[0]?.message ?? "Dados inválidos.", fieldErrors };
}

/** Mensagem genérica em português, sem vazar detalhes internos do banco. */
export function friendlyDbError(error: { code?: string; message?: string } | null | undefined): string {
  if (!error) return "Não foi possível concluir a operação.";
  switch (error.code) {
    case "42501":
      return "Você não tem permissão para esta ação.";
    case "23505":
      return "Já existe um registro com esses dados.";
    case "23503":
      return "Este registro está em uso e não pode ser alterado assim.";
    case "23514":
      return "Dados inválidos.";
    case "22023":
    case "P0001":
      // Só as nossas funções SQL usam esses códigos, sempre com mensagem em português.
      return error.message || "Dados inválidos.";
    case "PGRST116":
      return "Registro não encontrado.";
    default:
      return "Não foi possível concluir a operação. Tente novamente.";
  }
}
