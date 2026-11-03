import { describe, expect, it } from "vitest";
import {
  addMonths,
  formatDateBR,
  formatMonthLong,
  isIsoDate,
  isMonth,
  lastMonths,
  monthEnd,
  todayISO,
} from "./dates";

describe("datas e meses", () => {
  it("hoje é calculado no fuso America/Sao_Paulo", () => {
    // 02:30 UTC de 1º/11 ainda é 31/10 em São Paulo (UTC−3).
    expect(todayISO(new Date("2026-11-01T02:30:00Z"))).toBe("2026-10-31");
    expect(todayISO(new Date("2026-11-01T03:30:00Z"))).toBe("2026-11-01");
  });

  it("aritmética de meses atravessa o ano", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-11", 2)).toBe("2027-01");
    expect(lastMonths("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(monthEnd("2024-02")).toBe("2024-02-29");
    expect(monthEnd("2026-02")).toBe("2026-02-28");
    expect(monthEnd("2026-10")).toBe("2026-10-31");
  });

  it("valida datas e meses", () => {
    expect(isIsoDate("2026-02-29")).toBe(false);
    expect(isIsoDate("2024-02-29")).toBe(true);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("01/10/2026")).toBe(false);
    expect(isMonth("2026-10")).toBe(true);
    expect(isMonth("2026-1")).toBe(false);
  });

  it("formata em português", () => {
    expect(formatMonthLong("2026-10")).toBe("outubro de 2026");
    expect(formatDateBR("2026-10-05")).toBe("05/10/2026");
  });
});
