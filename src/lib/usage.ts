import { db } from "@/lib/db";

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Orçamentos criados no mês corrente (base do limite do plano Grátis). */
export async function quotesThisMonth(orgId: string) {
  return db.quote.count({
    where: { orgId, createdAt: { gte: startOfMonth() } },
  });
}
