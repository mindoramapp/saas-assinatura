import { handleStripeEvent, verifyStripeEvent } from "@/lib/billing/webhook";

export async function POST(request: Request) {
  // A assinatura é calculada sobre o corpo cru: ler como texto, nunca como JSON.
  const rawBody = await request.text();
  let event;
  try {
    event = verifyStripeEvent(rawBody, request.headers.get("stripe-signature"));
  } catch {
    return Response.json({ error: "assinatura inválida" }, { status: 400 });
  }
  const outcome = await handleStripeEvent(event);
  return Response.json({ received: true, outcome });
}
