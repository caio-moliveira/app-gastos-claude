import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestUser, deleteTestUsers, hasSupabase, adminClient, type TestUser } from "./helpers";

describe.skipIf(!hasSupabase)("RLS de espaços e membros (Supabase)", () => {
  let owner: TestUser;
  let editor: TestUser;
  let viewer: TestUser;
  let outsider: TestUser;
  let sharedSpaceId: string;
  let ownerPersonalId: string;

  beforeAll(async () => {
    owner = await createTestUser("owner");
    editor = await createTestUser("editor");
    viewer = await createTestUser("viewer");
    outsider = await createTestUser("outsider");

    const personal = await owner.client.rpc("ensure_personal_space");
    expect(personal.error).toBeNull();
    ownerPersonalId = personal.data as string;

    const shared = await owner.client.rpc("create_space", { p_name: "Casa Teste", p_type: "shared" });
    expect(shared.error).toBeNull();
    sharedSpaceId = shared.data as string;

    const add = await owner.client.from("space_members").insert([
      { space_id: sharedSpaceId, user_id: editor.id, role: "editor" },
      { space_id: sharedSpaceId, user_id: viewer.id, role: "viewer" },
    ]);
    expect(add.error).toBeNull();
  });

  afterAll(async () => {
    await deleteTestUsers([owner, editor, viewer, outsider]);
  });

  it("ensure_personal_space cria 'Pessoal' uma única vez e o criador é dono", async () => {
    const again = await owner.client.rpc("ensure_personal_space");
    expect(again.data).toBe(ownerPersonalId);

    const { data } = await owner.client.from("spaces").select("name, type").eq("id", ownerPersonalId).single();
    expect(data).toEqual({ name: "Pessoal", type: "individual" });

    const role = await owner.client.rpc("space_role", { p_space_id: ownerPersonalId });
    expect(role.data).toBe("owner");
  });

  it("membros enxergam apenas os espaços dos quais participam", async () => {
    const { data: viewerSpaces } = await viewer.client.from("spaces").select("id");
    expect(viewerSpaces?.map((s) => s.id)).toEqual([sharedSpaceId]);

    const { data: outsiderSpaces } = await outsider.client.from("spaces").select("id");
    expect(outsiderSpaces).toEqual([]);

    const { data: hidden } = await outsider.client.from("space_members").select("user_id").eq("space_id", sharedSpaceId);
    expect(hidden).toEqual([]);
  });

  it("só o dono renomeia o espaço", async () => {
    const byEditor = await editor.client.from("spaces").update({ name: "Hack" }).eq("id", sharedSpaceId).select("id");
    expect(byEditor.data).toEqual([]);

    const byViewer = await viewer.client.from("spaces").update({ name: "Hack" }).eq("id", sharedSpaceId).select("id");
    expect(byViewer.data).toEqual([]);

    const byOutsider = await outsider.client.from("spaces").update({ name: "Hack" }).eq("id", ownerPersonalId).select("id");
    expect(byOutsider.data).toEqual([]);

    const byOwner = await owner.client.from("spaces").update({ name: "Casa Renomeada" }).eq("id", sharedSpaceId).select("name");
    expect(byOwner.data).toEqual([{ name: "Casa Renomeada" }]);
  });

  it("o dono só altera o nome: tipo e criador são imutáveis, e de membros só o papel muda", async () => {
    const type = await owner.client.from("spaces").update({ type: "individual" }).eq("id", sharedSpaceId);
    expect(type.error).not.toBeNull();

    const createdBy = await owner.client.from("spaces").update({ created_by: outsider.id }).eq("id", sharedSpaceId);
    expect(createdBy.error).not.toBeNull();

    const moveMember = await owner.client
      .from("space_members")
      .update({ user_id: outsider.id })
      .eq("space_id", sharedSpaceId)
      .eq("user_id", viewer.id);
    expect(moveMember.error).not.toBeNull();

    const { data } = await adminClient().from("spaces").select("type, created_by").eq("id", sharedSpaceId).single();
    expect(data).toEqual({ type: "shared", created_by: owner.id });
  });

  it("ninguém cria espaço direto na tabela nem se adiciona como membro", async () => {
    const direct = await outsider.client
      .from("spaces")
      .insert({ name: "Direto", type: "individual", created_by: outsider.id });
    expect(direct.error).not.toBeNull();

    const selfJoin = await outsider.client
      .from("space_members")
      .insert({ space_id: sharedSpaceId, user_id: outsider.id, role: "editor" });
    expect(selfJoin.error).not.toBeNull();

    const viewerPromotes = await viewer.client
      .from("space_members")
      .update({ role: "editor" })
      .eq("space_id", sharedSpaceId)
      .eq("user_id", viewer.id)
      .select("role");
    expect(viewerPromotes.data ?? []).toEqual([]);
  });

  it("a linha do dono não pode ser alterada nem removida, e não há segundo dono", async () => {
    const demote = await owner.client
      .from("space_members")
      .update({ role: "viewer" })
      .eq("space_id", sharedSpaceId)
      .eq("user_id", owner.id)
      .select("role");
    expect(demote.data ?? []).toEqual([]);

    const secondOwner = await owner.client
      .from("space_members")
      .update({ role: "owner" })
      .eq("space_id", sharedSpaceId)
      .eq("user_id", editor.id)
      .select("role");
    expect(secondOwner.error).not.toBeNull();

    const { count } = await adminClient()
      .from("space_members")
      .select("*", { count: "exact", head: true })
      .eq("space_id", sharedSpaceId)
      .eq("role", "owner");
    expect(count).toBe(1);
  });

  it("só o dono exclui o espaço, em cascata", async () => {
    const byEditor = await editor.client.from("spaces").delete().eq("id", sharedSpaceId).select("id");
    expect(byEditor.data).toEqual([]);

    const temp = await owner.client.rpc("create_space", { p_name: "Temporário", p_type: "shared" });
    const tempId = temp.data as string;
    const del = await owner.client.from("spaces").delete().eq("id", tempId).select("id");
    expect(del.data).toEqual([{ id: tempId }]);

    const { count } = await adminClient()
      .from("space_members")
      .select("*", { count: "exact", head: true })
      .eq("space_id", tempId);
    expect(count).toBe(0);
  });

  it("usuário anônimo não lê nada", async () => {
    const { anonClient } = await import("./helpers");
    const { data, error } = await anonClient().from("spaces").select("id");
    expect(error !== null || (data ?? []).length === 0).toBe(true);
  });
});
