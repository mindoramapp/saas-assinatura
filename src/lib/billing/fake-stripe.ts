import { randomBytes } from "node:crypto";
import { PLANS } from "@/lib/plans";
import { priceIdFor, stripe, webhookSecret } from "./stripe";
import type { SubscriptionPayload } from "./webhook";

/**
 * "Stripe de mentira" para o portfólio (BILLING_MODE=fake): gera eventos no
 * mesmo formato da API do Stripe, assina com o SDK oficial e entrega por HTTP
 * ao nosso webhook, que verifica a assinatura como faria em produção.
 */

type PaidPlan = "PRO" | "BUSINESS";
const MONTH = 30 * 86_400;

function now() {
  return Math.floor(Date.now() / 1000);
}

export function fakeId(prefix: string) {
  return `${prefix}_fake_${randomBytes(9).toString("base64url")}`;
}

export function buildSubscription(input: {
  id?: string;
  orgId: string;
  customer: string;
  plan: PaidPlan;
  status?: string;
  cancelAtPeriodEnd?: boolean;
  created?: number;
  periodEnd?: number;
  canceledAt?: number | null;
}): SubscriptionPayload {
  const created = input.created ?? now();
  return {
    id: input.id ?? fakeId("sub"),
    object: "subscription",
    customer: input.customer,
    status: input.status ?? "active",
    cancel_at_period_end: input.cancelAtPeriodEnd ?? false,
    canceled_at: input.canceledAt ?? null,
    created,
    metadata: { orgId: input.orgId },
    items: {
      data: [
        {
          price: {
            id: priceIdFor(input.plan),
            unit_amount: PLANS[input.plan].priceCents,
          },
          current_period_end: input.periodEnd ?? created + MONTH,
        },
      ],
    },
  };
}

export function buildEvent(
  type:
    | "customer.subscription.created"
    | "customer.subscription.updated"
    | "customer.subscription.deleted",
  subscription: SubscriptionPayload,
  created = now(),
) {
  return {
    id: fakeId("evt"),
    object: "event" as const,
    type,
    created,
    livemode: false,
    data: { object: subscription },
  };
}

export type Deliver = (payload: string, signature: string) => Promise<Response>;

/** Entrega padrão: POST no webhook do próprio app, como o Stripe faria. */
const httpDeliver: Deliver = (payload, signature) =>
  fetch(
    `${process.env.APP_URL ?? "http://localhost:3000"}/api/webhooks/stripe`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "stripe-signature": signature,
      },
      body: payload,
    },
  );

export function signPayload(payload: string, secret = webhookSecret()) {
  return stripe().webhooks.generateTestHeaderString({ payload, secret });
}

export async function sendEvent(
  event: ReturnType<typeof buildEvent>,
  deliver: Deliver = httpDeliver,
) {
  const payload = JSON.stringify(event);
  const response = await deliver(payload, signPayload(payload));
  if (!response.ok) throw new Error(`Webhook respondeu ${response.status}`);
  return (await response.json()) as { outcome: string };
}
