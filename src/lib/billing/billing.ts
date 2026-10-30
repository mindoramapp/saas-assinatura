import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { getOrgAccess } from "@/lib/orgs";
import { comparePlans, isPlanId, PLANS } from "@/lib/plans";
import {
  buildEvent,
  buildSubscription,
  sendEvent,
  type Deliver,
} from "./fake-stripe";
import { billingMode, priceIdFor, stripe } from "./stripe";

type PaidPlan = "PRO" | "BUSINESS";

function parsePaidPlan(value: string): PaidPlan {
  if (!isPlanId(value) || value === "FREE") {
    throw new DomainError("invalid", "Plano inválido.");
  }
  return value;
}

export async function getActiveSubscription(orgId: string) {
  return db.subscription.findFirst({
    where: { orgId, status: { in: ["active", "trialing", "past_due"] } },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Começa a assinatura. Devolve a URL do checkout: a página simulada no modo
 * fake, ou a Checkout Session do Stripe no modo real.
 */
export async function startCheckout(input: {
  actorId: string;
  orgSlug: string;
  plan: string;
  appUrl: string;
}) {
  const { org } = await getOrgAccess(
    input.actorId,
    input.orgSlug,
    "billing:manage",
  );
  const plan = parsePaidPlan(input.plan);
  if (await getActiveSubscription(org.id)) {
    throw new DomainError(
      "conflict",
      "Sua empresa já tem uma assinatura. Use a troca de plano.",
    );
  }
  await audit({
    orgId: org.id,
    actorId: input.actorId,
    action: "billing.checkout_started",
    metadata: { plan },
  });

  if (billingMode() === "fake")
    return `/checkout-simulado/${org.slug}?plano=${plan}`;

  const session = await stripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceIdFor(plan), quantity: 1 }],
    subscription_data: { metadata: { orgId: org.id } },
    client_reference_id: org.id,
    success_url: `${input.appUrl}/app/${org.slug}/plano?aviso=assinado`,
    cancel_url: `${input.appUrl}/app/${org.slug}/plano`,
  });
  if (!session.url) throw new Error("Stripe não devolveu a URL do checkout");
  return session.url;
}

/** Modo fake: o "pagamento" do checkout simulado cria a assinatura via webhook. */
export async function completeFakeCheckout(input: {
  actorId: string;
  orgSlug: string;
  plan: string;
  deliver?: Deliver;
}) {
  if (billingMode() !== "fake")
    throw new DomainError("forbidden", "Checkout simulado desligado.");
  const { org } = await getOrgAccess(
    input.actorId,
    input.orgSlug,
    "billing:manage",
  );
  const plan = parsePaidPlan(input.plan);
  if (await getActiveSubscription(org.id)) {
    throw new DomainError(
      "conflict",
      "Sua empresa já tem uma assinatura ativa.",
    );
  }
  const customer =
    (await db.organization.findUniqueOrThrow({ where: { id: org.id } }))
      .stripeCustomerId ?? `cus_fake_${org.id}`;
  const subscription = buildSubscription({ orgId: org.id, customer, plan });
  return sendEvent(
    buildEvent("customer.subscription.created", subscription),
    input.deliver,
  );
}

async function requireSubscription(actorId: string, orgSlug: string) {
  const { org } = await getOrgAccess(actorId, orgSlug, "billing:manage");
  const sub = await getActiveSubscription(org.id);
  if (!sub)
    throw new DomainError("not_found", "Sua empresa não tem assinatura ativa.");
  return { org, sub };
}

function rebuild(
  sub: Awaited<ReturnType<typeof requireSubscription>>["sub"],
  changes: Partial<Parameters<typeof buildSubscription>[0]> = {},
) {
  return buildSubscription({
    id: sub.id,
    orgId: sub.orgId,
    customer: sub.customerId,
    plan: parsePaidPlan(sub.plan),
    status: sub.status,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    created: Math.floor(sub.createdAt.getTime() / 1000),
    periodEnd: sub.currentPeriodEnd
      ? Math.floor(sub.currentPeriodEnd.getTime() / 1000)
      : undefined,
    ...changes,
  });
}

/** Upgrade ou downgrade entre planos pagos (no Stripe real: Billing Portal). */
export async function changePlan(input: {
  actorId: string;
  orgSlug: string;
  plan: string;
  deliver?: Deliver;
}) {
  const { org, sub } = await requireSubscription(input.actorId, input.orgSlug);
  const plan = parsePaidPlan(input.plan);
  if (plan === sub.plan)
    throw new DomainError(
      "conflict",
      `Sua empresa já está no plano ${PLANS[plan].name}.`,
    );
  const direction: "upgrade" | "downgrade" =
    comparePlans(plan, parsePaidPlan(sub.plan)) > 0 ? "upgrade" : "downgrade";
  await audit({
    orgId: org.id,
    actorId: input.actorId,
    action: "billing.plan_change_requested",
    metadata: { from: sub.plan, to: plan, direction },
  });
  const result = await sendEvent(
    buildEvent(
      "customer.subscription.updated",
      rebuild(sub, { plan, cancelAtPeriodEnd: false }),
    ),
    input.deliver,
  );
  return { ...result, direction };
}

/** Cancela no fim do período (o cliente mantém o plano até lá), ou desfaz o cancelamento. */
export async function setCancelAtPeriodEnd(input: {
  actorId: string;
  orgSlug: string;
  cancel: boolean;
  deliver?: Deliver;
}) {
  const { org, sub } = await requireSubscription(input.actorId, input.orgSlug);
  if (input.cancel) {
    await audit({
      orgId: org.id,
      actorId: input.actorId,
      action: "billing.cancel_requested",
    });
  }
  return sendEvent(
    buildEvent(
      "customer.subscription.updated",
      rebuild(sub, { cancelAtPeriodEnd: input.cancel }),
    ),
    input.deliver,
  );
}

/** Só no modo fake: adianta o relógio até o fim do período e encerra a assinatura. */
export async function endPeriodNow(input: {
  actorId: string;
  orgSlug: string;
  deliver?: Deliver;
}) {
  if (billingMode() !== "fake")
    throw new DomainError("forbidden", "Disponível só na simulação.");
  const { sub } = await requireSubscription(input.actorId, input.orgSlug);
  const at = Math.floor(Date.now() / 1000);
  return sendEvent(
    buildEvent(
      "customer.subscription.deleted",
      rebuild(sub, { status: "canceled", canceledAt: at }),
    ),
    input.deliver,
  );
}
