import { describe, expect, it } from "vitest";
import { centsToInput, formatBRL, maskAmountInput, parseAmountToCents } from "./money";

describe("formatação de centavos em BRL", () => {
  it("formata centavos como R$ no padrão pt-BR", () => {
    expect(formatBRL(123456)).toBe("R$ 1.234,56");
    expect(formatBRL(5)).toBe("R$ 0,05");
    expect(formatBRL(0)).toBe("R$ 0,00");
    expect(formatBRL(-75000)).toBe("-R$ 750,00");
    expect(formatBRL(100_000_000)).toBe("R$ 1.000.000,00");
  });

  it("máscara de digitação trata os dígitos como centavos", () => {
    expect(maskAmountInput("123456")).toBe("1.234,56");
    expect(maskAmountInput("1.234,567")).toBe("12.345,67");
    expect(maskAmountInput("5")).toBe("0,05");
    expect(maskAmountInput("abc")).toBe("");
    expect(maskAmountInput("000")).toBe("");
  });

  it("centsToInput preenche inputs sem símbolo", () => {
    expect(centsToInput(123456)).toBe("1.234,56");
    expect(centsToInput(1000)).toBe("10,00");
  });
});

describe("parsing de valor digitado", () => {
  it("valor digitado 1.234,56 vira 123456 centavos", () => {
    expect(parseAmountToCents("1.234,56")).toEqual({ ok: true, cents: 123456 });
  });

  it("aceita variações comuns de digitação", () => {
    expect(parseAmountToCents("1234,56")).toEqual({ ok: true, cents: 123456 });
    expect(parseAmountToCents("R$ 1.234,56")).toEqual({ ok: true, cents: 123456 });
    expect(parseAmountToCents("1234.56")).toEqual({ ok: true, cents: 123456 });
    expect(parseAmountToCents("10")).toEqual({ ok: true, cents: 1000 });
    expect(parseAmountToCents("10,5")).toEqual({ ok: true, cents: 1050 });
    expect(parseAmountToCents("0,01")).toEqual({ ok: true, cents: 1 });
    expect(parseAmountToCents("1.234")).toEqual({ ok: true, cents: 123400 });
    expect(parseAmountToCents("1.234.567,89")).toEqual({ ok: true, cents: 123456789 });
  });

  it("-10, 0 e abc são rejeitados", () => {
    expect(parseAmountToCents("-10").ok).toBe(false);
    expect(parseAmountToCents("0").ok).toBe(false);
    expect(parseAmountToCents("0,00").ok).toBe(false);
    expect(parseAmountToCents("abc").ok).toBe(false);
  });

  it("rejeita formatos ambíguos ou inválidos", () => {
    expect(parseAmountToCents("").ok).toBe(false);
    expect(parseAmountToCents("1,234,56").ok).toBe(false);
    expect(parseAmountToCents("12,345").ok).toBe(false);
    expect(parseAmountToCents("12.34.5").ok).toBe(false);
    expect(parseAmountToCents("1e5").ok).toBe(false);
    expect(parseAmountToCents("99999999999999").ok).toBe(false);
  });
});
