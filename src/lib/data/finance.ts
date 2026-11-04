import "server-only";
import { cache } from "react";
import { createClient, type ServerSupabase } from "@/lib/supabase/server";
import type { Tx } from "@/lib/finance/rules";
import { escapeLike } from "@/lib/finance/search";
import type { AccountType, CategoryKind, TransactionType } from "@/lib/validation/finance";

export type Account = {
  id: string;
  space_id: string;
  name: string;
  type: AccountType;
  initial_balance_cents: number;
  archived: boolean;
};

export type Category = {
  id: string;
  space_id: string;
  name: string;
  kind: CategoryKind;
  color: string;
  icon: string | null;
};

export type TransactionRow = {
  id: string;
  space_id: string;
  account_id: string;
  category_id: string | null;
  type: TransactionType;
  amount_cents: number;
  date: string;
  description: string;
  notes: string | null;
  transfer_to_account_id: string | null;
};

const PAGE = 1000;

const LIST_COLUMNS =
  "id, space_id, account_id, category_id, type, amount_cents, date, description, notes, transfer_to_account_id";

export const getAccounts = cache(async (spaceId: string): Promise<Account[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("id, space_id, name, type, initial_balance_cents, archived")
    .eq("space_id", spaceId)
    .order("archived")
    .order("name");
  if (error) throw new Error("Não foi possível carregar as contas.");
  return (data ?? []).map((a) => ({ ...a, type: a.type as AccountType, initial_balance_cents: Number(a.initial_balance_cents) }));
});

export const getCategories = cache(async (spaceId: string): Promise<Category[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, space_id, name, kind, color, icon")
    .eq("space_id", spaceId)
    .order("kind", { ascending: false })
    .order("name");
  if (error) throw new Error("Não foi possível carregar as categorias.");
  return (data ?? []).map((c) => ({ ...c, kind: c.kind as CategoryKind }));
});

/**
 * Todas as transações do espaço (colunas necessárias para os cálculos), paginando de 1000 em 1000.
 * `from`/`to` limitam o intervalo de datas (inclusive).
 */
export const getLedger = cache(async (spaceId: string, from?: string, to?: string): Promise<Tx[]> => {
  const supabase = await createClient();
  const out: Tx[] = [];
  for (let offset = 0; ; offset += PAGE) {
    let query = supabase
      .from("transactions")
      .select("id, account_id, transfer_to_account_id, category_id, type, amount_cents, date")
      .eq("space_id", spaceId)
      .order("date")
      .order("id")
      .range(offset, offset + PAGE - 1);
    if (from) query = query.gte("date", from);
    if (to) query = query.lte("date", to);
    const { data, error } = await query;
    if (error) throw new Error("Não foi possível carregar as transações.");
    for (const t of data ?? []) {
      out.push({ ...t, type: t.type as TransactionType, amount_cents: Number(t.amount_cents) });
    }
    if (!data || data.length < PAGE) break;
  }
  return out;
});

export type TransactionFilters = {
  month?: string;
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  search?: string;
};

export const TRANSACTIONS_PAGE_SIZE = 25;

/** Maiores despesas de um intervalo (inclusive), da maior para a menor. */
export const getTopExpenses = cache(async (spaceId: string, from: string, to: string, limit = 5): Promise<TransactionRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .select(LIST_COLUMNS)
    .eq("space_id", spaceId)
    .eq("type", "expense")
    .gte("date", from)
    .lte("date", to)
    .order("amount_cents", { ascending: false })
    .order("date", { ascending: false })
    .order("id")
    .limit(limit);
  if (error) throw new Error("Não foi possível carregar as maiores despesas.");
  return (data ?? []).map((t) => ({ ...t, type: t.type as TransactionType, amount_cents: Number(t.amount_cents) }));
});

type ListFilters = TransactionFilters & { from?: string; to?: string };

/** Consulta de transações com os filtros da tela (ids já validados como UUID pela página). */
function filteredTransactions(supabase: ServerSupabase, spaceId: string, filters: ListFilters, head: boolean) {
  let query = supabase
    .from("transactions")
    .select(LIST_COLUMNS, { count: "exact", head })
    .eq("space_id", spaceId);
  if (filters.from) query = query.gte("date", filters.from);
  if (filters.to) query = query.lte("date", filters.to);
  if (filters.accountId) {
    query = query.or(`account_id.eq.${filters.accountId},transfer_to_account_id.eq.${filters.accountId}`);
  }
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.type) query = query.eq("type", filters.type);
  if (filters.search) {
    query = query.ilike("description", `%${escapeLike(filters.search)}%`);
  }
  return query;
}

/**
 * Lista paginada para a tela de transações, ordenada por data decrescente (desempate por id).
 * Página além do fim devolve `rows: []` com o total real, para a página redirecionar.
 */
export async function getTransactionsPage(
  spaceId: string,
  filters: ListFilters,
  page: number,
): Promise<{ rows: TransactionRow[]; total: number }> {
  const supabase = await createClient();
  const start = (page - 1) * TRANSACTIONS_PAGE_SIZE;
  const { data, error, count } = await filteredTransactions(supabase, spaceId, filters, false)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    // Desempate único: linhas inseridas juntas têm o mesmo created_at.
    .order("id", { ascending: false })
    .range(start, start + TRANSACTIONS_PAGE_SIZE - 1);
  if (error?.code === "PGRST103") {
    const head = await filteredTransactions(supabase, spaceId, filters, true);
    if (head.error) throw new Error("Não foi possível carregar as transações.");
    return { rows: [], total: head.count ?? 0 };
  }
  if (error) throw new Error("Não foi possível carregar as transações.");
  return {
    rows: (data ?? []).map((t) => ({ ...t, type: t.type as TransactionType, amount_cents: Number(t.amount_cents) })),
    total: count ?? 0,
  };
}
