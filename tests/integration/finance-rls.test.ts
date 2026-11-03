import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUsers, hasSupabase, type TestUser } from "./helpers";

describe.skipIf(!hasSupabase)("contas, categorias e transações (Supabase)", () => {
  let owner: TestUser;
  let editor: TestUser;
  let viewer: TestUser;
  let outsider: TestUser;
  let spaceId: string;
  let otherSpaceId: string;
  let accountId: string;
  let savingsId: string;
  let expenseCat: string;
  let incomeCat: string;
  let foreignAccountId: string;
  let foreignCategoryId: string;

  beforeAll(async () => {
    owner = await createTestUser("fin-owner");
    editor = await createTestUser("fin-editor");
    viewer = await createTestUser("fin-viewer");
    outsider = await createTestUser("fin-outsider");

    spaceId = (await owner.client.rpc("create_space", { p_name: "Casa Fin", p_type: "shared" })).data as string;
    await owner.client.from("space_members").insert([
      { space_id: spaceId, user_id: editor.id, role: "editor" },
      { space_id: spaceId, user_id: viewer.id, role: "viewer" },
    ]);
    otherSpaceId = (await outsider.client.rpc("ensure_personal_space")).data as string;

    const { data: cats } = await owner.client.from("categories").select("id, name, kind").eq("space_id", spaceId);
    expenseCat = cats!.find((c) => c.name === "Mercado" && c.kind === "expense")!.id;
    incomeCat = cats!.find((c) => c.name === "Salário")!.id;

    const acc = await editor.client
      .from("accounts")
      .insert({ space_id: spaceId, name: "Conta corrente", type: "checking", initial_balance_cents: 100_000 })
      .select("id")
      .single();
    expect(acc.error).toBeNull();
    accountId = acc.data!.id;
    savingsId = (
      await owner.client.from("accounts").insert({ space_id: spaceId, name: "Poupança", type: "savings" }).select("id").single()
    ).data!.id;

    foreignAccountId = (await outsider.client.from("accounts").select("id").eq("space_id", otherSpaceId).limit(1).single()).data!.id;
    foreignCategoryId = (
      await outsider.client.from("categories").select("id").eq("space_id", otherSpaceId).eq("kind", "expense").limit(1).single()
    ).data!.id;
  });

  afterAll(async () => {
    await deleteTestUsers([owner, editor, viewer, outsider]);
  });

  it("espaço novo nasce com as 12 categorias padrão e a conta Carteira", async () => {
    const { data: cats } = await owner.client.from("categories").select("name, kind").eq("space_id", spaceId);
    expect(cats).toHaveLength(12);
    expect(cats!.filter((c) => c.kind === "income").map((c) => c.name).sort()).toEqual(["Freelance", "Outros", "Salário"]);
    expect(cats!.filter((c) => c.kind === "expense")).toHaveLength(9);
    const { data: accs } = await outsider.client.from("accounts").select("name, type").eq("space_id", otherSpaceId);
    expect(accs).toEqual([{ name: "Carteira", type: "cash" }]);
  });

  it("editor cria, edita e exclui transação; leitor e estranho não escrevem", async () => {
    const created = await editor.client
      .from("transactions")
      .insert({
        space_id: spaceId,
        account_id: accountId,
        category_id: expenseCat,
        type: "expense",
        amount_cents: 25_000,
        date: "2026-10-07",
        description: "Supermercado Bom Preço",
      })
      .select("id, created_by")
      .single();
    expect(created.error).toBeNull();
    expect(created.data!.created_by).toBe(editor.id);
    const txId = created.data!.id;

    const byViewer = await viewer.client.from("transactions").insert({
      space_id: spaceId,
      account_id: accountId,
      category_id: expenseCat,
      type: "expense",
      amount_cents: 100,
      date: "2026-10-07",
      description: "Tentativa",
    });
    expect(byViewer.error).not.toBeNull();

    const viewerUpdate = await viewer.client.from("transactions").update({ amount_cents: 1 }).eq("id", txId).select("id");
    expect(viewerUpdate.data ?? []).toEqual([]);
    const viewerDelete = await viewer.client.from("transactions").delete().eq("id", txId).select("id");
    expect(viewerDelete.data ?? []).toEqual([]);

    const outsiderRead = await outsider.client.from("transactions").select("id").eq("space_id", spaceId);
    expect(outsiderRead.data).toEqual([]);
    const outsiderUpdate = await outsider.client.from("transactions").update({ amount_cents: 1 }).eq("id", txId).select("id");
    expect(outsiderUpdate.data ?? []).toEqual([]);

    const viewerRead = await viewer.client.from("transactions").select("amount_cents").eq("id", txId).single();
    expect(Number(viewerRead.data!.amount_cents)).toBe(25_000);

    const edited = await editor.client.from("transactions").update({ amount_cents: 30_000 }).eq("id", txId).select("amount_cents");
    expect(Number(edited.data![0].amount_cents)).toBe(30_000);

    const deleted = await owner.client.from("transactions").delete().eq("id", txId).select("id");
    expect(deleted.data).toEqual([{ id: txId }]);
  });

  it("transação não aponta para conta ou categoria de outro espaço", async () => {
    const foreignAccount = await editor.client.from("transactions").insert({
      space_id: spaceId,
      account_id: foreignAccountId,
      category_id: expenseCat,
      type: "expense",
      amount_cents: 100,
      date: "2026-10-07",
      description: "Conta alheia",
    });
    expect(foreignAccount.error).not.toBeNull();

    const foreignCategory = await editor.client.from("transactions").insert({
      space_id: spaceId,
      account_id: accountId,
      category_id: foreignCategoryId,
      type: "expense",
      amount_cents: 100,
      date: "2026-10-07",
      description: "Categoria alheia",
    });
    expect(foreignCategory.error).not.toBeNull();

    const foreignTransfer = await editor.client.from("transactions").insert({
      space_id: spaceId,
      account_id: accountId,
      transfer_to_account_id: foreignAccountId,
      type: "transfer",
      amount_cents: 100,
      date: "2026-10-07",
      description: "Transferência para fora",
    });
    expect(foreignTransfer.error).not.toBeNull();
  });

  it("regras de formato: valor positivo, categoria do tipo certo e transferência sem categoria", async () => {
    const base = { space_id: spaceId, account_id: accountId, date: "2026-10-07", description: "Teste" };
    const zero = await editor.client.from("transactions").insert({ ...base, type: "expense", category_id: expenseCat, amount_cents: 0 });
    expect(zero.error).not.toBeNull();
    const wrongKind = await editor.client.from("transactions").insert({ ...base, type: "expense", category_id: incomeCat, amount_cents: 100 });
    expect(wrongKind.error).not.toBeNull();
    const transferWithCategory = await editor.client
      .from("transactions")
      .insert({ ...base, type: "transfer", category_id: expenseCat, transfer_to_account_id: savingsId, amount_cents: 100 });
    expect(transferWithCategory.error).not.toBeNull();
    const selfTransfer = await editor.client
      .from("transactions")
      .insert({ ...base, type: "transfer", transfer_to_account_id: accountId, amount_cents: 100 });
    expect(selfTransfer.error).not.toBeNull();
    const ok = await editor.client
      .from("transactions")
      .insert({ ...base, type: "transfer", transfer_to_account_id: savingsId, amount_cents: 100 })
      .select("id")
      .single();
    expect(ok.error).toBeNull();

    // Conta com transação não pode ser excluída (deve ser arquivada).
    const delAccount = await editor.client.from("accounts").delete().eq("id", savingsId);
    expect(delAccount.error?.code).toBe("23503");
    await editor.client.from("transactions").delete().eq("id", ok.data!.id);
  });

  it("leitor não cria conta nem categoria; estranho não vê contas", async () => {
    const acc = await viewer.client.from("accounts").insert({ space_id: spaceId, name: "Hack", type: "cash" });
    expect(acc.error).not.toBeNull();
    const cat = await viewer.client.from("categories").insert({ space_id: spaceId, name: "Hack", kind: "expense" });
    expect(cat.error).not.toBeNull();
    const seen = await outsider.client.from("accounts").select("id").eq("space_id", spaceId);
    expect(seen.data).toEqual([]);
  });

  it("delete_category move as transações para outra categoria do mesmo tipo", async () => {
    const temp = (
      await editor.client.from("categories").insert({ space_id: spaceId, name: "Temporária", kind: "expense" }).select("id").single()
    ).data!.id;
    const tx = (
      await editor.client
        .from("transactions")
        .insert({
          space_id: spaceId,
          account_id: accountId,
          category_id: temp,
          type: "expense",
          amount_cents: 500,
          date: "2026-10-08",
          description: "Na temporária",
        })
        .select("id")
        .single()
    ).data!.id;

    const withoutTarget = await editor.client.rpc("delete_category", { p_category_id: temp });
    expect(withoutTarget.error).not.toBeNull();
    const wrongKind = await editor.client.rpc("delete_category", { p_category_id: temp, p_move_to: incomeCat });
    expect(wrongKind.error).not.toBeNull();
    const byViewer = await viewer.client.rpc("delete_category", { p_category_id: temp, p_move_to: expenseCat });
    expect(byViewer.error).not.toBeNull();

    const moved = await editor.client.rpc("delete_category", { p_category_id: temp, p_move_to: expenseCat });
    expect(moved.error).toBeNull();
    const { data } = await editor.client.from("transactions").select("category_id").eq("id", tx).single();
    expect(data!.category_id).toBe(expenseCat);
    await editor.client.from("transactions").delete().eq("id", tx);
  });
});
