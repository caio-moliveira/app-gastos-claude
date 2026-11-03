import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRole, uuidSchema, type Role, type SpaceType } from "@/lib/validation/spaces";

export type SpaceSummary = {
  id: string;
  name: string;
  type: SpaceType;
  role: Role;
};

export type SpaceContext = {
  userId: string;
  email: string;
  space: SpaceSummary;
  spaces: SpaceSummary[];
};

/** Usuário autenticado (validado no Auth) ou redireciona para /login. */
export const requireUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
});

/** Espaços em que o usuário é membro, com o papel dele em cada um. */
export const listMySpaces = cache(async (): Promise<SpaceSummary[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("space_members")
    .select("role, joined_at, spaces!inner(id, name, type)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });
  if (error) throw new Error("Não foi possível carregar seus espaços.");
  return (data ?? [])
    .filter((row) => isRole(row.role))
    .map((row) => ({
      id: row.spaces.id,
      name: row.spaces.name,
      type: row.spaces.type as SpaceType,
      role: row.role as Role,
    }));
});

/**
 * Contexto do espaço da rota. Se o usuário não for membro (ou o id for inválido),
 * responde 404 — a RLS já impediria a leitura de qualquer forma.
 */
export const getSpaceContext = cache(async (spaceId: string): Promise<SpaceContext> => {
  if (!uuidSchema.safeParse(spaceId).success) notFound();
  const user = await requireUser();
  const spaces = await listMySpaces();
  const space = spaces.find((s) => s.id === spaceId);
  if (!space) notFound();
  return { userId: user.id, email: user.email ?? "", space, spaces };
});
