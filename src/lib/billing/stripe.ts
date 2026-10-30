import Stripe from "stripe";
import type { PlanId } from "@/lib/plans";

let client: Stripe | null = null;

/** Cliente do SDK oficial. No modo fake só os helpers de webhook são usados. */
export function stripe(): Stripe {
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_fake");
  return client;
}

export function webhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET não configurado");
  return secret;
}

export function billingMode(): "fake" | "stripe" {
  return process.env.BILLING_MODE === "stripe" ? "stripe" : "fake";
}

type PaidPlan = Exclude<PlanId, "FREE">;

export function priceIdFor(plan: PaidPlan): string {
  const id =
    plan === "PRO"
      ? process.env.STRIPE_PRICE_PRO
      : process.env.STRIPE_PRICE_BUSINESS;
  return id ?? (plan === "PRO" ? "price_pro_mensal" : "price_business_mensal");
}

export function planForPrice(priceId: string | undefined): PaidPlan | null {
  if (!priceId) return null;
  if (priceId === priceIdFor("PRO")) return "PRO";
  if (priceId === priceIdFor("BUSINESS")) return "BUSINESS";
  return null;
}
