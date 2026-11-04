import { describe, expect, it } from "vitest";
import { escapeLike } from "./search";

describe("busca por descrição", () => {
  it("escapa curingas do ILIKE para buscar o texto literal", () => {
    expect(escapeLike("50%")).toBe("50\\%");
    expect(escapeLike("nota_fiscal")).toBe("nota\\_fiscal");
    expect(escapeLike("a\\b")).toBe("a\\\\b");
    expect(escapeLike("Mercado da Vila")).toBe("Mercado da Vila");
  });
});
