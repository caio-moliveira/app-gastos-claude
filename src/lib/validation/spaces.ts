import { z } from "zod";

export const SPACE_TYPES = ["individual", "shared"] as const;
export type SpaceType = (typeof SPACE_TYPES)[number];

export const ROLES = ["owner", "editor", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const uuidSchema = z.string().uuid("Identificador inválido.");

export const spaceNameSchema = z
  .string()
  .trim()
  .min(1, "Informe o nome do espaço.")
  .max(60, "O nome do espaço deve ter no máximo 60 caracteres.");

export const createSpaceSchema = z.object({
  name: spaceNameSchema,
  type: z.enum(SPACE_TYPES, { message: "Tipo de espaço inválido." }),
});

export const renameSpaceSchema = z.object({
  spaceId: uuidSchema,
  name: spaceNameSchema,
});

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

export function canEdit(role: Role | null | undefined): boolean {
  return role === "owner" || role === "editor";
}

export function isOwner(role: Role | null | undefined): boolean {
  return role === "owner";
}

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Dono",
  editor: "Editor",
  viewer: "Leitor",
};

export const SPACE_TYPE_LABELS: Record<SpaceType, string> = {
  individual: "Individual",
  shared: "Compartilhado",
};
