"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formDataToObject, friendlyDbError, zodErrorToState, type FormState } from "@/lib/forms";
import { createSpaceSchema, renameSpaceSchema, uuidSchema } from "@/lib/validation/spaces";

export async function createSpaceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = createSpaceSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return zodErrorToState(parsed.error);

  const supabase = await createClient();
  const { data: spaceId, error } = await supabase.rpc("create_space", {
    p_name: parsed.data.name,
    p_type: parsed.data.type,
  });
  if (error || !spaceId) return { error: friendlyDbError(error) };

  revalidatePath("/", "layout");
  redirect(`/s/${spaceId}`);
}

export async function renameSpaceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = renameSpaceSchema.safeParse(formDataToObject(formData));
  if (!parsed.success) return zodErrorToState(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("spaces")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.spaceId)
    .select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data || data.length === 0) return { error: "Só o dono pode renomear o espaço." };

  revalidatePath(`/s/${parsed.data.spaceId}`, "layout");
  return { success: "Espaço renomeado." };
}

export async function deleteSpaceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = formDataToObject(formData);
  const id = uuidSchema.safeParse(raw.spaceId);
  if (!id.success) return { error: "Espaço inválido." };

  const supabase = await createClient();
  const { data: space } = await supabase.from("spaces").select("name").eq("id", id.data).maybeSingle();
  if (!space) return { error: "Espaço não encontrado." };
  if ((raw.confirm ?? "").trim() !== space.name) {
    return { error: "Digite o nome do espaço exatamente como aparece para confirmar.", fieldErrors: { confirm: "Nome não confere." } };
  }

  const { data, error } = await supabase.from("spaces").delete().eq("id", id.data).select("id");
  if (error) return { error: friendlyDbError(error) };
  if (!data || data.length === 0) return { error: "Só o dono pode excluir o espaço." };

  revalidatePath("/", "layout");
  redirect("/");
}
