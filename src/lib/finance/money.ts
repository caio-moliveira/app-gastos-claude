/**
 * Dinheiro sempre em centavos inteiros (number seguro até 2^53; o banco usa bigint).
 * A formatação em BRL acontece só na borda da UI.
 */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** 123456 → "R$ 1.234,56" (com espaço normal, não o NBSP do Intl). */
export function formatBRL(cents: number): string {
  return brl.format(cents / 100).replace(/ /g, " ");
}

/** 123456 → "1.234,56" (para preencher inputs). */
export function centsToInput(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
}

/**
 * Máscara de digitação: usa só os dígitos como centavos ("123456" → "1.234,56").
 * Vazio continua vazio para o campo poder ser limpo.
 */
export function maskAmountInput(raw: string): string {
  const digits = (raw ?? "").replace(/\D/g, "").replace(/^0+/, "").slice(0, 11);
  if (!digits) return "";
  return centsToInput(Number(digits));
}

export type ParseResult = { ok: true; cents: number } | { ok: false; error: string };

const MAX_CENTS = 99_999_999_999; // R$ 999.999.999,99

/**
 * Converte o valor digitado (formato brasileiro) em centavos positivos.
 * Aceita "1.234,56", "1234,56", "1234.56", "R$ 10", "10". Rejeita zero, negativos e texto.
 */
export function parseAmountToCents(input: string): ParseResult {
  const raw = (input ?? "").replace(/R\$/gi, "").replace(/\s| /g, "");
  if (!raw) return { ok: false, error: "Informe o valor." };
  if (raw.startsWith("-")) return { ok: false, error: "O valor deve ser maior que zero." };
  if (!/^[0-9.,]+$/.test(raw)) return { ok: false, error: "Valor inválido." };

  let normalized: string;
  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  if (lastComma >= 0) {
    // Vírgula é o separador decimal; pontos são milhares.
    if (raw.indexOf(",") !== lastComma) return { ok: false, error: "Valor inválido." };
    const intPart = raw.slice(0, lastComma);
    const decPart = raw.slice(lastComma + 1);
    if (!/^\d{0,2}$/.test(decPart)) return { ok: false, error: "Use no máximo duas casas decimais." };
    if (intPart.includes(".") && !/^\d{1,3}(\.\d{3})+$/.test(intPart)) return { ok: false, error: "Valor inválido." };
    normalized = `${intPart.replace(/\./g, "") || "0"}.${decPart.padEnd(2, "0")}`;
  } else if (lastDot >= 0) {
    const decPart = raw.slice(lastDot + 1);
    if (raw.indexOf(".") === lastDot && decPart.length <= 2) {
      // "1234.5" ou "1234.56": ponto decimal.
      normalized = `${raw.slice(0, lastDot) || "0"}.${decPart.padEnd(2, "0")}`;
    } else if (/^\d{1,3}(\.\d{3})+$/.test(raw)) {
      // "1.234" ou "1.234.567": pontos de milhar.
      normalized = `${raw.replace(/\./g, "")}.00`;
    } else {
      return { ok: false, error: "Valor inválido." };
    }
  } else {
    normalized = `${raw}.00`;
  }

  const [intStr, decStr] = normalized.split(".");
  if (!/^\d+$/.test(intStr) || !/^\d{2}$/.test(decStr)) return { ok: false, error: "Valor inválido." };
  const cents = Number(intStr) * 100 + Number(decStr);
  if (!Number.isSafeInteger(cents)) return { ok: false, error: "Valor muito alto." };
  if (cents <= 0) return { ok: false, error: "O valor deve ser maior que zero." };
  if (cents > MAX_CENTS) return { ok: false, error: "Valor muito alto." };
  return { ok: true, cents };
}
