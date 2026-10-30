export const PLAN_IDS = ["FREE", "PRO", "BUSINESS"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
  /** Orçamentos criados por mês (Infinity = ilimitado). */
  quotesPerMonth: number;
  /** Membros + convites pendentes. */
  seats: number;
  customBranding: boolean;
  auditExport: boolean;
  highlights: string[];
};

export const PLANS: Record<PlanId, Plan> = {
  FREE: {
    id: "FREE",
    name: "Grátis",
    priceCents: 0,
    quotesPerMonth: 5,
    seats: 1,
    customBranding: false,
    auditExport: false,
    highlights: [
      "5 orçamentos por mês",
      "1 pessoa",
      "Link para o cliente aprovar",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    priceCents: 4900,
    quotesPerMonth: Infinity,
    seats: 5,
    customBranding: true,
    auditExport: false,
    highlights: ["Orçamentos ilimitados", "Até 5 pessoas", "Cor da sua marca"],
  },
  BUSINESS: {
    id: "BUSINESS",
    name: "Business",
    priceCents: 12900,
    quotesPerMonth: Infinity,
    seats: Infinity,
    customBranding: true,
    auditExport: true,
    highlights: ["Tudo do Pro", "Equipe ilimitada", "Exportar auditoria (CSV)"],
  },
};

export function isPlanId(value: string): value is PlanId {
  return (PLAN_IDS as readonly string[]).includes(value);
}

export function getPlan(value: string): Plan {
  return isPlanId(value) ? PLANS[value] : PLANS.FREE;
}

/** Ordem dos planos, para saber se uma troca é upgrade ou downgrade. */
export function comparePlans(a: PlanId, b: PlanId): number {
  return PLAN_IDS.indexOf(a) - PLAN_IDS.indexOf(b);
}

export type LimitCheck = { ok: true } | { ok: false; reason: string };

export function canCreateQuote(
  plan: Plan,
  quotesThisMonth: number,
): LimitCheck {
  if (quotesThisMonth < plan.quotesPerMonth) return { ok: true };
  return {
    ok: false,
    reason: `O plano ${plan.name} permite ${plan.quotesPerMonth} orçamentos por mês. Faça upgrade para criar mais.`,
  };
}

export function canAddSeat(
  plan: Plan,
  membersAndPendingInvites: number,
): LimitCheck {
  if (membersAndPendingInvites < plan.seats) return { ok: true };
  return {
    ok: false,
    reason: `O plano ${plan.name} permite ${plan.seats} ${plan.seats === 1 ? "pessoa" : "pessoas"}. Faça upgrade para convidar mais.`,
  };
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
