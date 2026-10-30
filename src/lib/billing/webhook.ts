import type Stripe from "stripe";
import { db } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { comparePlans, PLANS, type PlanId } from "@/lib/plans";
import { planForPrice, stripe, webhookSecret } from "./stripe";

/** Só os campos da assinatura que o Orçaí lê (iguais aos da API do Stripe). */
export type SubscriptionPayload = {
  id: string;
  object: "subscription";
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  canceled_at: number | null;
  created: number;
  metadata: Record<string, string>;
  items: {
    data: {
      price: { id: string; unit_amount: number | null };
      current_period_end?: number;
    }[];
  };
};

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

/** Status em que o cliente continua com os recursos do plano pago. */
const ENTITLED = new Set(["active", "trialing", "past_due"]);

export type WebhookOutcome = "applied" | "stale" | "ignored" | "duplicate";

/** Verifica a assinatura do Stripe (lança erro se o corpo ou o cabeçalho foram adulterados). */
export function verifyStripeEvent(
  rawBody: string,
  signature: string | null,
): Stripe.Event {
  if (!signature) throw new Error("Cabeçalho stripe-signature ausente");
  return stripe().webhooks.constructEvent(rawBody, signature, webhookSecret());
}

type Tx = Prisma.TransactionClient;

/**
 * Processa um evento exatamente uma vez. O registro em ProcessedEvent e as
 * mudanças ficam na mesma transação: se algo falhar, nada é gravado e a nova
 * tentativa do Stripe processa de novo; se o mesmo evento chegar duas vezes
 * (inclusive ao mesmo tempo), a chave primária barra a segunda.
 */
export async function handleStripeEvent(
  event: Pick<Stripe.Event, "id" | "type" | "created" | "data">,
) {
  try {
    return await db.$transaction(async (tx) => {
      await tx.processedEvent.create({
        data: { id: event.id, type: event.type, outcome: "pending" },
      });
      const outcome: WebhookOutcome = SUBSCRIPTION_EVENTS.has(event.type)
        ? await applySubscriptionEvent(
            tx,
            event.type,
            event.created,
            event.data.object as unknown as SubscriptionPayload,
          )
        : "ignored";
      await tx.processedEvent.update({
        where: { id: event.id },
        data: { outcome },
      });
      return outcome;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return "duplicate" as const;
    }
    throw error;
  }
}

async function applySubscriptionEvent(
  tx: Tx,
  type: string,
  created: number,
  sub: SubscriptionPayload,
): Promise<WebhookOutcome> {
  const org =
    (sub.metadata.orgId &&
      (await tx.organization.findUnique({
        where: { id: sub.metadata.orgId },
      }))) ||
    (await tx.organization.findUnique({
      where: { stripeCustomerId: sub.customer },
    }));
  if (!org) return "ignored";

  const eventAt = new Date(created * 1000);
  const existing = await tx.subscription.findUnique({ where: { id: sub.id } });
  // Fora de ordem: evento mais antigo que o último aplicado não volta o estado.
  // Assinatura cancelada é final no Stripe, então nada a reabre.
  if (
    existing &&
    (existing.lastEventAt > eventAt || existing.status === "canceled")
  ) {
    return "stale";
  }

  const item = sub.items.data[0];
  const plan = planForPrice(item?.price.id);
  if (!plan) return "ignored";
  const status =
    type === "customer.subscription.deleted" ? "canceled" : sub.status;
  const data = {
    orgId: org.id,
    customerId: sub.customer,
    plan,
    status,
    priceCents: item?.price.unit_amount ?? PLANS[plan].priceCents,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    currentPeriodEnd: item?.current_period_end
      ? new Date(item.current_period_end * 1000)
      : null,
    canceledAt:
      status === "canceled"
        ? new Date((sub.canceled_at ?? created) * 1000)
        : null,
    lastEventAt: eventAt,
  };
  await tx.subscription.upsert({
    where: { id: sub.id },
    create: { id: sub.id, createdAt: new Date(sub.created * 1000), ...data },
    update: data,
  });

  // O plano da org sai de TODAS as assinaturas dela: um cancelamento antigo que
  // chega atrasado não derruba uma assinatura nova.
  const active = await tx.subscription.findMany({
    where: { orgId: org.id, status: { in: [...ENTITLED] } },
  });
  const newPlan = active
    .map((s) => s.plan as PlanId)
    .reduce<PlanId>(
      (best, p) => (comparePlans(p, best) > 0 ? p : best),
      "FREE",
    );

  await tx.organization.update({
    where: { id: org.id },
    data: {
      plan: newPlan,
      stripeCustomerId: org.stripeCustomerId ?? sub.customer,
    },
  });
  await tx.auditLog.create({
    data: {
      orgId: org.id,
      actorId: null,
      action:
        status === "canceled"
          ? "billing.subscription_canceled"
          : "billing.subscription_updated",
      target: sub.id,
      metadata: JSON.stringify({
        event: type,
        status,
        plan,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        orgPlan: { from: org.plan, to: newPlan },
      }),
    },
  });
  return "applied";
}
