/**
 * Aplica supabase/migrations/*.sql em ordem no banco de DATABASE_URL.
 * O controle de versões fica em claude.schema_migrations (o projeto Supabase é
 * compartilhado, então não usamos o histórico global do `supabase db push`).
 * Uso: npm run db:migrate
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { requireEnv } from "./load-env";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

async function main() {
  const client = new Client({ connectionString: requireEnv("DATABASE_URL") });
  await client.connect();
  try {
    await client.query(`
      create schema if not exists claude;
      create table if not exists claude.schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      );
      alter table claude.schema_migrations enable row level security;
      revoke all on claude.schema_migrations from anon, authenticated;
    `);

    const applied = new Set(
      (await client.query<{ version: string }>("select version from claude.schema_migrations")).rows.map(
        (r) => r.version,
      ),
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      if (applied.has(version)) continue;
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      process.stdout.write(`→ aplicando ${file} ... `);
      await client.query("begin");
      try {
        await client.query(sql);
        await client.query("insert into claude.schema_migrations (version) values ($1)", [version]);
        await client.query("commit");
        console.log("ok");
        count++;
      } catch (error) {
        await client.query("rollback");
        console.log("ERRO");
        throw error;
      }
    }
    // Pede ao PostgREST para recarregar o schema (novas tabelas/funções).
    await client.query("notify pgrst, 'reload schema'");
    console.log(count === 0 ? "Nenhuma migration pendente." : `${count} migration(s) aplicada(s).`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
