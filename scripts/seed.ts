/**
 * npm run seed — deixa o ambiente pronto para demonstração (PRD §9).
 * Idempotente: usuários, espaços, contas e transações têm chaves estáveis e são gravados com upsert.
 * Usa a SUPABASE_SERVICE_ROLE_KEY localmente (nunca no app da Vercel).
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types";
import { addMonths, currentMonth, formatMonthLong, lastMonths, todayISO } from "../src/lib/finance/dates";
import { formatBRL } from "../src/lib/finance/money";
import { categoryBreakdown, monthTotals, type Tx } from "../src/lib/finance/rules";
import { MAX_TX_PER_MONTH, generateMonth, stableUuid, type SeedSpaceKey, type SeedTx } from "../src/lib/seed/generator";
import { requireEnv } from "./load-env";

export const SEED_PASSWORD = "Cofre!2026";
export const SEED_USERS = {
  ana: { email: "ana.claude@cofre.test", name: "Ana" },
  bruno: { email: "bruno.claude@cofre.test", name: "Bruno" },
  carla: { email: "carla.claude@cofre.test", name: "Carla" },
} as const;
type UserKey = keyof typeof SEED_USERS;

const admin = createClient<Database, "claude">(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
  db: { schema: "claude" },
  auth: { persistSession: false, autoRefreshToken: false },
});

function check<R extends { data: unknown; error: { message: string } | null }>(label: string, result: R): NonNullable<R["data"]> {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data as NonNullable<R["data"]>;
}

async function findUserByEmail(email: string) {
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const found = data.users.find((u) => u.email?.toLowerCase() === email);
    if (found) return found;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser(key: UserKey): Promise<string> {
  const { email, name } = SEED_USERS[key];
  const existing = await findUserByEmail(email);
  if (existing) {
    check(
      `updateUser(${key})`,
      await admin.auth.admin.updateUserById(existing.id, { password: SEED_PASSWORD, email_confirm: true, user_metadata: { name } }),
    );
    check(`profile(${key})`, await admin.from("profiles").upsert({ id: existing.id, name }));
    return existing.id;
  }
  const created = check(
    `createUser(${key})`,
    await admin.auth.admin.createUser({ email, password: SEED_PASSWORD, email_confirm: true, user_metadata: { name } }),
  );
  return created.user!.id;
}

type SpaceSpec = {
  key: SeedSpaceKey;
  name: string;
  type: "individual" | "shared";
  owner: UserKey;
  members: Array<{ user: UserKey; role: "editor" | "viewer" }>;
  accounts: Array<{ key: string; name: string; type: Database["claude"]["Tables"]["accounts"]["Insert"]["type"]; initial: number }>;
};

const SPACES: SpaceSpec[] = [
  {
    key: "pessoal",
    name: "Pessoal",
    type: "individual",
    owner: "ana",
    members: [],
    accounts: [
      { key: "checking", name: "Conta corrente", type: "checking", initial: 250_000 },
      { key: "card", name: "Cartão de crédito", type: "credit_card", initial: 0 },
    ],
  },
  {
    key: "casa",
    name: "Casa",
    type: "shared",
    owner: "bruno",
    members: [
      { user: "ana", role: "editor" },
      { user: "carla", role: "viewer" },
    ],
    accounts: [
      { key: "checking", name: "Conta corrente", type: "checking", initial: 350_000 },
      { key: "card", name: "Cartão de crédito", type: "credit_card", initial: 0 },
      { key: "savings", name: "Poupança", type: "savings", initial: 800_000 },
    ],
  },
];

export const SEED_SPACE_IDS: Record<SeedSpaceKey, string> = {
  pessoal: stableUuid("space:pessoal"),
  casa: stableUuid("space:casa"),
};

async function ensureSpace(spec: SpaceSpec, users: Record<UserKey, string>) {
  const spaceId = SEED_SPACE_IDS[spec.key];
  check(
    `space(${spec.key})`,
    await admin.from("spaces").upsert({ id: spaceId, name: spec.name, type: spec.type, created_by: users[spec.owner] }),
  );
  check(
    `owner(${spec.key})`,
    await admin.from("space_members").upsert({ space_id: spaceId, user_id: users[spec.owner], role: "owner" }, { onConflict: "space_id,user_id" }),
  );
  for (const m of spec.members) {
    check(
      `member(${spec.key}:${m.user})`,
      await admin.from("space_members").upsert({ space_id: spaceId, user_id: users[m.user], role: m.role }, { onConflict: "space_id,user_id" }),
    );
  }
  check(`defaults(${spec.key})`, await admin.rpc("seed_space_defaults", { p_space_id: spaceId }));

  const accountIds: Record<string, string> = {};
  for (const a of spec.accounts) {
    const id = stableUuid(`account:${spec.key}:${a.key}`);
    check(
      `account(${spec.key}:${a.key})`,
      await admin.from("accounts").upsert({ id, space_id: spaceId, name: a.name, type: a.type, initial_balance_cents: a.initial, archived: false }),
    );
    accountIds[a.key] = id;
  }
  const wallet = check(
    `wallet(${spec.key})`,
    await admin.from("accounts").select("id").eq("space_id", spaceId).eq("name", "Carteira").single(),
  );
  accountIds.wallet = wallet.id;

  const cats = check(`categories(${spec.key})`, await admin.from("categories").select("id, name, kind").eq("space_id", spaceId));
  const categoryIds = new Map(cats.map((c) => [`${c.kind}:${c.name}`, c.id]));
  return { spaceId, accountIds, categoryIds };
}

function toRows(
  txs: SeedTx[],
  spaceId: string,
  createdBy: string,
  accountIds: Record<string, string>,
  categoryIds: Map<string, string>,
) {
  return txs.map((t) => {
    const categoryId = t.category ? categoryIds.get(`${t.type === "income" ? "income" : "expense"}:${t.category}`) : null;
    if (t.category && !categoryId) throw new Error(`Categoria não encontrada: ${t.category}`);
    return {
      id: t.id,
      space_id: spaceId,
      type: t.type,
      amount_cents: t.amount_cents,
      date: t.date,
      description: t.description,
      account_id: accountIds[t.account],
      transfer_to_account_id: t.to_account ? accountIds[t.to_account] : null,
      category_id: t.type === "transfer" ? null : (categoryId ?? null),
      created_by: createdBy,
    };
  });
}

async function main() {
  const today = todayISO();
  const months = lastMonths(currentMonth(), 12);
  console.log(`Seed do Cofre — ${months[0]} a ${months[months.length - 1]} (hoje ${today})`);

  const users = {} as Record<UserKey, string>;
  for (const key of Object.keys(SEED_USERS) as UserKey[]) users[key] = await ensureUser(key);
  console.log("✓ usuários", Object.values(SEED_USERS).map((u) => u.email).join(", "));

  const generated: Record<SeedSpaceKey, SeedTx[]> = { pessoal: [], casa: [] };
  for (const spec of SPACES) {
    const { spaceId, accountIds, categoryIds } = await ensureSpace(spec, users);
    // O mês anterior à janela só serve para calcular a primeira fatura do cartão.
    let cardBill = generateMonth(spec.key, addMonths(months[0], -1), 0).cardSpent;
    const all: SeedTx[] = [];
    for (const month of months) {
      const { txs, cardSpent } = generateMonth(spec.key, month, cardBill);
      cardBill = cardSpent;
      all.push(...txs.filter((t) => t.date <= today));
    }
    generated[spec.key] = all;
    const rows = toRows(all, spaceId, users[spec.owner], accountIds, categoryIds);
    for (let i = 0; i < rows.length; i += 500) {
      check(`transactions(${spec.key})`, await admin.from("transactions").upsert(rows.slice(i, i + 500), { onConflict: "id" }));
    }
    // Remove só ids que o próprio seed poderia ter gerado e que não são mais gerados
    // (ex.: gerador ajustado). Transações criadas por usuários nunca entram nessa lista.
    const keep = new Set(all.map((t) => t.id));
    const stale: string[] = [];
    for (const month of lastMonths(currentMonth(), 24)) {
      for (let seq = 0; seq < MAX_TX_PER_MONTH; seq++) {
        const id = stableUuid(`${spec.key}:${month}:${seq}`);
        if (!keep.has(id)) stale.push(id);
      }
    }
    for (let i = 0; i < stale.length; i += 200) {
      check(`cleanup(${spec.key})`, await admin.from("transactions").delete().eq("space_id", spaceId).in("id", stale.slice(i, i + 200)));
    }
    console.log(`✓ ${spec.name}: ${rows.length} transações em ${months.length} meses`);
  }

  // Conferência rápida (PRD §9): totais de outubro em Casa.
  const october = months.filter((m) => m.endsWith("-10")).pop();
  if (october) {
    const casa: SeedTx[] = generated.casa;
    const ledger: Tx[] = casa.map((t) => ({
      account_id: t.account,
      transfer_to_account_id: t.to_account ?? null,
      category_id: t.category ?? null,
      type: t.type,
      amount_cents: t.amount_cents,
      date: t.date,
    }));
    const totals = monthTotals(ledger, october);
    console.log(`\nCasa — ${formatMonthLong(october)}`);
    console.log(`  Receitas:  ${formatBRL(totals.income)}`);
    console.log(`  Despesas:  ${formatBRL(totals.expense)}`);
    console.log(`  Resultado: ${formatBRL(totals.result)}`);
    for (const c of categoryBreakdown(ledger, october)) console.log(`  ${c.category_id.padEnd(12)} ${formatBRL(c.total)}`);
  }

  console.log(`\nLogin: ${Object.values(SEED_USERS).map((u) => u.email).join(" / ")} — senha ${SEED_PASSWORD}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
