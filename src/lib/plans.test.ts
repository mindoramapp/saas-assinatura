import { describe, expect, it } from "vitest";
import {
  canAddSeat,
  canCreateQuote,
  comparePlans,
  formatBRL,
  getPlan,
  PLANS,
} from "./plans";

describe("limites por plano", () => {
  it("Grátis bloqueia o 6º orçamento do mês", () => {
    expect(canCreateQuote(PLANS.FREE, 4).ok).toBe(true);
    const sixth = canCreateQuote(PLANS.FREE, 5);
    expect(sixth.ok).toBe(false);
    if (!sixth.ok) expect(sixth.reason).toMatch(/upgrade/);
  });

  it("Pro e Business não limitam orçamentos", () => {
    expect(canCreateQuote(PLANS.PRO, 10_000).ok).toBe(true);
    expect(canCreateQuote(PLANS.BUSINESS, 10_000).ok).toBe(true);
  });

  it("assentos contam membros e convites pendentes", () => {
    expect(canAddSeat(PLANS.FREE, 1).ok).toBe(false);
    expect(canAddSeat(PLANS.PRO, 4).ok).toBe(true);
    expect(canAddSeat(PLANS.PRO, 5).ok).toBe(false);
    expect(canAddSeat(PLANS.BUSINESS, 500).ok).toBe(true);
  });
});

describe("utilitários", () => {
  it("plano desconhecido vira Grátis", () => {
    expect(getPlan("ENTERPRISE").id).toBe("FREE");
  });

  it("compara planos para upgrade/downgrade", () => {
    expect(comparePlans("PRO", "FREE")).toBeGreaterThan(0);
    expect(comparePlans("PRO", "BUSINESS")).toBeLessThan(0);
  });

  it("formata em reais", () => {
    expect(formatBRL(4900).replace(/\s/g, " ")).toBe("R$ 49,00");
  });
});
