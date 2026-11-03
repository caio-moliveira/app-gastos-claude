import { redirect } from "next/navigation";
import { requireUser } from "@/lib/spaces";
import { createClient } from "@/lib/supabase/server";

// Ponto de entrada: garante o espaço "Pessoal" no primeiro acesso e abre o espaço padrão.
export default async function Home() {
  await requireUser();
  const supabase = await createClient();
  const { data: spaceId, error } = await supabase.rpc("ensure_personal_space");
  if (error || !spaceId) throw new Error("Não foi possível abrir seu espaço.");
  redirect(`/s/${spaceId}`);
}
