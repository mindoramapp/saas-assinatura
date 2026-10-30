import { db } from "@/lib/db";

const DAY = 86_400_000;

type SubRow = {
  priceCents: number;
  status: string;
  createdAt: Date;
  canceledAt: Date | null;
  plan: string;
};

/** Assinatura gera receita entre o início e o cancelamento. */
function activeAt(sub: SubRow, at: Date) {
  return sub.createdAt <= at && (!sub.canceledAt || sub.canceledAt > at);
}

/**
 * MRR numa data: soma das mensalidades das assinaturas ativas nela.
 * Simplificação documentada: usa o preço atual da assinatura (troca de plano
 * no meio do histórico não é reconstruída).
 */
export function mrrAt(subs: SubRow[], at: Date): number {
  return subs
    .filter((s) => activeAt(s, at))
    .reduce((sum, s) => sum + s.priceCents, 0);
}

/** MRR no fim de cada um dos últimos `months` meses (o último ponto é "agora"). */
export function mrrSeries(subs: SubRow[], now: Date, months = 12) {
  return Array.from({ length: months }, (_, i) => {
    const offset = months - 1 - i;
    const monthEnd =
      offset === 0
        ? now
        : new Date(
            now.getFullYear(),
            now.getMonth() - offset + 1,
            0,
            23,
            59,
            59,
          );
    return {
      label: monthEnd.toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      }),
      value: mrrAt(subs, monthEnd),
    };
  });
}

/**
 * Churn de clientes na janela: cancelados na janela ÷ ativos no início dela.
 * Churn de receita: MRR perdido com esses cancelamentos ÷ MRR no início.
 */
export function churn(subs: SubRow[], now: Date, days = 30) {
  const start = new Date(now.getTime() - days * DAY);
  const atStart = subs.filter((s) => activeAt(s, start));
  const lost = atStart.filter(
    (s) => s.canceledAt && s.canceledAt > start && s.canceledAt <= now,
  );
  const startMrr = atStart.reduce((sum, s) => sum + s.priceCents, 0);
  const lostMrr = lost.reduce((sum, s) => sum + s.priceCents, 0);
  return {
    customerRate: atStart.length ? lost.length / atStart.length : 0,
    revenueRate: startMrr ? lostMrr / startMrr : 0,
    canceled: lost.length,
    activeAtStart: atStart.length,
  };
}

type EventRow = {
  name: string;
  userId: string | null;
  orgId: string | null;
  createdAt: Date;
};

export function activeUsers(events: EventRow[], now: Date, days: number) {
  const since = now.getTime() - days * DAY;
  return new Set(
    events
      .filter((e) => e.userId && e.createdAt.getTime() > since)
      .map((e) => e.userId),
  ).size;
}

/** Usuários ativos por dia nos últimos `days` dias. */
export function dailyActiveSeries(events: EventRow[], now: Date, days = 30) {
  const buckets = new Map<string, Set<string>>();
  const keyOf = (d: Date) => d.toISOString().slice(0, 10);
  const series = Array.from({ length: days }, (_, i) => {
    const day = new Date(now.getTime() - (days - 1 - i) * DAY);
    buckets.set(keyOf(day), new Set());
    return day;
  });
  for (const e of events) {
    if (e.userId) buckets.get(keyOf(e.createdAt))?.add(e.userId);
  }
  return series.map((day) => ({
    label: day.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    value: buckets.get(keyOf(day))!.size,
  }));
}

/**
 * Ativação: das empresas criadas na janela, quantas criaram o primeiro
 * orçamento em até 7 dias. Empresas com menos de 7 dias ainda entram no
 * denominador só se já ativaram (não penaliza quem acabou de chegar).
 */
export function activation(events: EventRow[], now: Date, days = 90) {
  const since = now.getTime() - days * DAY;
  const created = events.filter(
    (e) => e.name === "org.created" && e.orgId && e.createdAt.getTime() > since,
  );
  const firstQuote = new Map<string, number>();
  for (const e of events) {
    if (e.name !== "quote.created" || !e.orgId) continue;
    const t = e.createdAt.getTime();
    if (!firstQuote.has(e.orgId) || t < firstQuote.get(e.orgId)!)
      firstQuote.set(e.orgId, t);
  }
  let eligible = 0;
  let activated = 0;
  for (const org of created) {
    const start = org.createdAt.getTime();
    const quoteAt = firstQuote.get(org.orgId!);
    const ok = quoteAt !== undefined && quoteAt - start <= 7 * DAY;
    if (ok) activated++;
    if (ok || now.getTime() - start >= 7 * DAY) eligible++;
  }
  return { rate: eligible ? activated / eligible : 0, activated, eligible };
}

export async function loadMetrics(now = new Date()) {
  const [subs, events, orgs] = await Promise.all([
    db.subscription.findMany({
      select: {
        priceCents: true,
        status: true,
        createdAt: true,
        canceledAt: true,
        plan: true,
      },
    }),
    db.analyticsEvent.findMany({
      where: { createdAt: { gt: new Date(now.getTime() - 120 * DAY) } },
      select: { name: true, userId: true, orgId: true, createdAt: true },
    }),
    db.organization.groupBy({ by: ["plan"], _count: { _all: true } }),
  ]);
  const series = mrrSeries(subs, now);
  const mrr = series.at(-1)!.value;
  const previous = series.at(-2)?.value ?? 0;
  const paying = subs.filter((s) => activeAt(s, now)).length;
  return {
    mrr,
    mrrGrowth: previous ? (mrr - previous) / previous : null,
    arpa: paying ? Math.round(mrr / paying) : 0,
    paying,
    mrrSeries: series,
    churn: churn(subs, now),
    dau: activeUsers(events, now, 1),
    mau: activeUsers(events, now, 30),
    dailyActive: dailyActiveSeries(events, now),
    activation: activation(events, now),
    plans: Object.fromEntries(
      orgs.map((o) => [o.plan, o._count._all]),
    ) as Record<string, number>,
  };
}
