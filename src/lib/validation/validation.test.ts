import { describe, expect, it } from "vitest";
import { loginSchema, safeNextPath, signupSchema } from "./auth";
import { canEdit, createSpaceSchema, isOwner, isRole } from "./spaces";

describe("validação de autenticação", () => {
  it("normaliza e-mail e exige senha", () => {
    const ok = loginSchema.safeParse({ email: "  Ana@Cofre.Test ", password: "x" });
    expect(ok.success && ok.data.email).toBe("ana@cofre.test");
    expect(loginSchema.safeParse({ email: "não-é-email", password: "x" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });

  it("cadastro exige nome e senha de 8+ caracteres", () => {
    expect(signupSchema.safeParse({ name: "Ana", email: "a@b.co", password: "1234567" }).success).toBe(false);
    expect(signupSchema.safeParse({ name: " ", email: "a@b.co", password: "12345678" }).success).toBe(false);
    expect(signupSchema.safeParse({ name: "Ana", email: "a@b.co", password: "12345678" }).success).toBe(true);
  });

  it("safeNextPath só aceita caminhos internos", () => {
    expect(safeNextPath("/s/abc")).toBe("/s/abc");
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("//evil.com")).toBe("/");
    expect(safeNextPath("/\\evil.com")).toBe("/");
    expect(safeNextPath("/\t/evil.com")).toBe("/");
    expect(safeNextPath("/\n/evil.com")).toBe("/");
    expect(safeNextPath("/\r/evil.com")).toBe("/");
    expect(safeNextPath("/s/abc?mes=2026-10#x")).toBe("/s/abc?mes=2026-10#x");
    expect(safeNextPath(undefined)).toBe("/");
  });
});

describe("validação de espaços e papéis", () => {
  it("nome do espaço entre 1 e 60 caracteres e tipo válido", () => {
    expect(createSpaceSchema.safeParse({ name: "Casa", type: "shared" }).success).toBe(true);
    expect(createSpaceSchema.safeParse({ name: "   ", type: "shared" }).success).toBe(false);
    expect(createSpaceSchema.safeParse({ name: "x".repeat(61), type: "shared" }).success).toBe(false);
    expect(createSpaceSchema.safeParse({ name: "Casa", type: "familia" }).success).toBe(false);
  });

  it("matriz de papéis: dono e editor editam; leitor não", () => {
    expect(canEdit("owner")).toBe(true);
    expect(canEdit("editor")).toBe(true);
    expect(canEdit("viewer")).toBe(false);
    expect(canEdit(null)).toBe(false);
    expect(isOwner("owner")).toBe(true);
    expect(isOwner("editor")).toBe(false);
    expect(isRole("admin")).toBe(false);
  });
});
