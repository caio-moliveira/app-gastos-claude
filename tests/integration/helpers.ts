import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

export type TestClient = SupabaseClient<Database, "claude">;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

/** Os testes de integração rodam só quando há um projeto Supabase configurado. */
export const hasSupabase = Boolean(url && anonKey && serviceKey);

const clientOptions = {
  db: { schema: "claude" as const },
  auth: { persistSession: false, autoRefreshToken: false },
};

export function adminClient(): TestClient {
  return createClient<Database, "claude">(url, serviceKey, clientOptions);
}

export function anonClient(): TestClient {
  return createClient<Database, "claude">(url, anonKey, clientOptions);
}

export type TestUser = { id: string; email: string; client: TestClient };

const RUN_ID = randomBytes(4).toString("hex");
const PASSWORD = `Teste!${randomBytes(6).toString("hex")}`;

/** Cria um usuário confirmado via Admin API e devolve um cliente logado como ele. */
export async function createTestUser(label: string): Promise<TestUser> {
  const admin = adminClient();
  const email = `rls-${label}-${RUN_ID}@claude-tests.cofre.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: `Teste ${label}` },
  });
  if (error || !data.user) throw new Error(`createUser(${label}): ${error?.message}`);

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signInError) throw new Error(`signIn(${label}): ${signInError.message}`);
  return { id: data.user.id, email, client };
}

export async function deleteTestUsers(users: Array<TestUser | undefined>) {
  const admin = adminClient();
  for (const user of users) {
    if (!user) continue;
    // Espaços criados pelo usuário caem em cascata (created_by → auth.users on delete cascade).
    await admin.auth.admin.deleteUser(user.id);
  }
}
