import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

/** Remove os usuários efêmeros criados pelos testes E2E (e-mails e2e-*@claude-tests.cofre.test). */
export default async function globalTeardown() {
  config({ path: ".env.local", quiet: true });
  config({ path: ".env", quiet: true });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return;

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) break;
    for (const user of data.users) {
      if (user.email?.startsWith("e2e-") && user.email.endsWith("@claude-tests.cofre.test")) {
        await admin.auth.admin.deleteUser(user.id);
      }
    }
    if (data.users.length < 200) break;
  }
}
