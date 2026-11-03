"use server";

import { revalidatePath } from "next/cache";
import { getAccounts, getCategories } from "@/lib/data/finance";
import { formDataToObject, friendlyDbError, zodErrorToState, type FormState } from "@/lib/forms";
import { listMySpaces } from "@/lib/spaces";
import { createClient } from "@/lib/supabase/server";
import { accountSchema, categorySchema, checkTransactionRefs, transactionSchema } from "@/lib/validation/finance";
import { canEdit, uuidSchema } from "@/lib/validation/spaces";

const NO_PERMISSION: FormState = { error: "Você não tem permissão para alterar este espaço." };

/** Checagem de papel para dar uma mensagem clara; a garantia real é a RLS. */
async function ensureEditor(spaceId: string): Promise<boolean> {
  const spaces = await listMySpaces();
  return canEdit(spaces.find((s) => s.id === spaceId)?.role);
}

function refresh(spaceId: string) {
  revalidatePath(`/s/${spaceId}`, "layout");
}

// ---------------------------------------------------------------------------
// Transações
// ---------------------------------------------------------------------------

export async function saveTransactionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = transactionSchema.safeParse(raw);
  if (!parsed.success) return zodErrorToState(parsed.error);
  const tx = parsed.data;
  const id = raw.id ? uuidSchema.safeParse(raw.id) : null;
  if (id && !id.success) return { error: "Transação inválida." };

  if (!(await ensureEditor(tx.spaceId))) return NO_PERMISSION;

  const [accounts, categories] = await Promise.all([getAccounts(tx.spaceId), getCategories(tx.spaceId)]);
  const refs = checkTransactionRefs(tx, accounts, categories);
  if (!refs.ok) return { error: refs.error, fieldErrors: { [refs.field]: refs.error } };

  const row = {
    space_id: tx.spaceId,
    type: tx.type,
    amount_cents: tx.amount,
    date: tx.date,
    account_id: tx.accountId,
    category_id: tx.categoryId,
    transfer_to_account_id: tx.transferToAccountId,
    description: tx.description,
    notes: tx.notes,
  };

  const supabase = await createClient();
  if (id?.success) {
    const { data, error } = await supabase
      .from("transactions")
      .update(row)
      .eq("id", id.data)
      .eq("space_id", tx.spaceId)
      .select("id");
    if (error) return { error: friendlyDbError(error) };
    if (!data?.length) return NO_PERMISSION;
  } else {
    const { error } = await supabase.from("transactions").insert(row);
    if (error) return { error: friendlyDbError(error) };
  }

  refresh(tx.spaceId);
  return { success: id?.success ? "Transação atualizada." : "Transação criada." };
}

export async function deleteTransactionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const spaceId = uuidSchema.safeParse(raw.spaceId);
  const id = uuidSchema.safeParse(raw.id);
  if (!spaceId.success || !id.success) return { error: "Transação inválida." };
  if (!(await ensureEditor(spaceId.data))) return NO_PERMISSION;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id.data)
    .eq("space_id", spaceId.data)
    .select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return NO_PERMISSION;

  refresh(spaceId.data);
  return { success: "Transação excluída." };
}

// ---------------------------------------------------------------------------
// Contas
// ---------------------------------------------------------------------------

export async function saveAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = accountSchema.safeParse(raw);
  if (!parsed.success) return zodErrorToState(parsed.error);
  const id = raw.id ? uuidSchema.safeParse(raw.id) : null;
  if (id && !id.success) return { error: "Conta inválida." };
  const { spaceId, name, type, initialBalance } = parsed.data;
  if (!(await ensureEditor(spaceId))) return NO_PERMISSION;

  const supabase = await createClient();
  const row = { space_id: spaceId, name, type, initial_balance_cents: initialBalance };
  if (id?.success) {
    const { data, error } = await supabase.from("accounts").update(row).eq("id", id.data).eq("space_id", spaceId).select("id");
    if (error) return { error: error.code === "23505" ? "Já existe uma conta com esse nome." : friendlyDbError(error) };
    if (!data?.length) return NO_PERMISSION;
  } else {
    const { error } = await supabase.from("accounts").insert(row);
    if (error) return { error: error.code === "23505" ? "Já existe uma conta com esse nome." : friendlyDbError(error) };
  }
  refresh(spaceId);
  return { success: id?.success ? "Conta atualizada." : "Conta criada." };
}

export async function setAccountArchivedAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const spaceId = uuidSchema.safeParse(raw.spaceId);
  const id = uuidSchema.safeParse(raw.id);
  if (!spaceId.success || !id.success) return { error: "Conta inválida." };
  if (!(await ensureEditor(spaceId.data))) return NO_PERMISSION;
  const archived = raw.archived === "true";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .update({ archived })
    .eq("id", id.data)
    .eq("space_id", spaceId.data)
    .select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return NO_PERMISSION;
  refresh(spaceId.data);
  return { success: archived ? "Conta arquivada." : "Conta reativada." };
}

export async function deleteAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const spaceId = uuidSchema.safeParse(raw.spaceId);
  const id = uuidSchema.safeParse(raw.id);
  if (!spaceId.success || !id.success) return { error: "Conta inválida." };
  if (!(await ensureEditor(spaceId.data))) return NO_PERMISSION;

  const supabase = await createClient();
  const { data, error } = await supabase.from("accounts").delete().eq("id", id.data).eq("space_id", spaceId.data).select("id");
  if (error) {
    if (error.code === "23503") return { error: "Esta conta tem transações. Arquive-a em vez de excluir." };
    return { error: friendlyDbError(error) };
  }
  if (!data?.length) return NO_PERMISSION;
  refresh(spaceId.data);
  return { success: "Conta excluída." };
}

// ---------------------------------------------------------------------------
// Categorias
// ---------------------------------------------------------------------------

export async function saveCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const parsed = categorySchema.safeParse(raw);
  if (!parsed.success) return zodErrorToState(parsed.error);
  const id = raw.id ? uuidSchema.safeParse(raw.id) : null;
  if (id && !id.success) return { error: "Categoria inválida." };
  const { spaceId, name, kind, color } = parsed.data;
  if (!(await ensureEditor(spaceId))) return NO_PERMISSION;

  const supabase = await createClient();
  const row = { space_id: spaceId, name, kind, color };
  const duplicate = "Já existe uma categoria com esse nome e tipo.";
  if (id?.success) {
    const { data, error } = await supabase.from("categories").update(row).eq("id", id.data).eq("space_id", spaceId).select("id");
    if (error) return { error: error.code === "23505" ? duplicate : friendlyDbError(error) };
    if (!data?.length) return NO_PERMISSION;
  } else {
    const { error } = await supabase.from("categories").insert(row);
    if (error) return { error: error.code === "23505" ? duplicate : friendlyDbError(error) };
  }
  refresh(spaceId);
  return { success: id?.success ? "Categoria atualizada." : "Categoria criada." };
}

export async function deleteCategoryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const spaceId = uuidSchema.safeParse(raw.spaceId);
  const id = uuidSchema.safeParse(raw.id);
  const moveTo = raw.moveTo ? uuidSchema.safeParse(raw.moveTo) : null;
  if (!spaceId.success || !id.success || (moveTo && !moveTo.success)) return { error: "Categoria inválida." };
  if (!(await ensureEditor(spaceId.data))) return NO_PERMISSION;

  const categories = await getCategories(spaceId.data);
  if (!categories.some((c) => c.id === id.data)) return { error: "Categoria não encontrada." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_category", {
    p_category_id: id.data,
    p_move_to: moveTo?.success ? moveTo.data : undefined,
  });
  if (error) {
    if (error.code === "23503") return { error: "A categoria está em uso (por exemplo, em um orçamento) e não pode ser excluída." };
    return { error: friendlyDbError(error) };
  }
  refresh(spaceId.data);
  return { success: moveTo?.success ? "Transações movidas e categoria excluída." : "Categoria excluída." };
}
