/**
 * Datas de transação são strings ISO "AAAA-MM-DD" (coluna `date`, sem hora).
 * Meses são "AAAA-MM". O "hoje" é sempre calculado no fuso America/Sao_Paulo.
 */

export const TIME_ZONE = "America/Sao_Paulo";

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DATE_RE = /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_RE.test(value);
}

/** Valida "AAAA-MM-DD" incluindo dias inexistentes (31/02). */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Data de hoje em São Paulo, "AAAA-MM-DD". */
export function todayISO(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function currentMonth(now: Date = new Date()): string {
  return todayISO(now).slice(0, 7);
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

/** Soma `delta` meses a "AAAA-MM". */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${String(ny).padStart(4, "0")}-${String(nm).padStart(2, "0")}`;
}

export function monthStart(month: string): string {
  return `${month}-01`;
}

/** Último dia do mês, "AAAA-MM-DD". */
export function monthEnd(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${month}-${String(last).padStart(2, "0")}`;
}

/** Lista de meses terminando em `month` (inclusive), do mais antigo ao mais recente. */
export function lastMonths(month: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(month, i - (count - 1)));
}

const MONTH_NAMES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

/** "2026-10" → "outubro de 2026". */
export function formatMonthLong(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} de ${y}`;
}

/** "2026-10" → "out/26". */
export function formatMonthShort(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)}/${String(y).slice(2)}`;
}

/** "2026-10-05" → "05/10/2026". */
export function formatDateBR(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}
