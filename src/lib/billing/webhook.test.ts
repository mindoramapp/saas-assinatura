import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/webhooks/stripe/route";
import { db } from "@/lib/db";
import { addMember, makeOrg } from "@/test/factories";
import {
  changePlan,
  completeFakeCheckout,
  endPeriodNow,
  setCancelAtPeriodEnd,
} from "./billing";
import {
  buildEvent,
  buildSubscription,
  sendEvent,
  signPayload,
  type Deliver,
} from "./fake-stripe";

/** Entrega direto na rota do webhook, sem servidor HTTP. */
const deliver: Deliver = (payload, signature) =>
  POST(
    new Request("http://localhost/api/webhooks/stripe", {
      method: "POST",
      headers: { "stripe-signature": signature },
      body: payload,
    }),
  );

async function orgPlan(orgId: string) {
  return (await db.organization.findUniqueOrThrow({ where: { id: orgId } }))
    .plan;
}

describe("rota do webhook", () => {
  it("recusa assinatura inválida ou ausente (400) e não grava nada", async () => {
    const org = await makeOrg();
    const event = buildEvent(
      "customer.subscription.created",
      buildSubscription({ orgId: org.id, customer: "cus_x", plan: "PRO" }),
    );
    const payload = JSON.stringify(event);

    const forged = await deliver(
      payload,
      signPayload(payload, "whsec_outro_segredo"),
    );
    expect(forged.status).toBe(400);
    // Corpo alterado depois de assinado também é recusado.
    const tampered = await deliver(
      payload.replace("price_pro_mensal", "price_business_mensal"),
      signPayload(payload),
    );
    expect(tampered.status).toBe(400);
    const missing = await POST(
      new Request("http://localhost/api/webhooks/stripe", {
        method: "POST",
        body: payload,
      }),
    );
    expect(missing.status).toBe(400);

    expect(
      await db.processedEvent.findUnique({ where: { id: event.id } }),
    ).toBeNull();
    expect(await orgPlan(org.id)).toBe("FREE");
  });

  it("é idempotente: o mesmo evento entregue 3 vezes só é aplicado uma", async () => {
    const org = await makeOrg();
    const event = buildEvent(
      "customer.subscription.created",
      buildSubscription({ orgId: org.id, customer: "cus_idem", plan: "PRO" }),
    );
    const outcomes = await Promise.all(
      [1, 2, 3].map(() => sendEvent(event, deliver)),
    );
    expect(outcomes.map((o) => o.outcome).sort()).toEqual([
      "applied",
      "duplicate",
      "duplicate",
    ]);
    expect(await orgPlan(org.id)).toBe("PRO");
    expect(
      await db.auditLog.count({
        where: { orgId: org.id, action: "billing.subscription_updated" },
      }),
    ).toBe(1);
  });
});

describe("eventos fora de ordem", () => {
  it("um 'updated' antigo que chega depois não desfaz o upgrade", async () => {
    const org = await makeOrg();
    const base = {
      id: "sub_ordem_1",
      orgId: org.id,
      customer: "cus_ordem",
      created: 1_000,
    };
    await sendEvent(
      buildEvent(
        "customer.subscription.created",
        buildSubscription({ ...base, plan: "PRO" }),
        1_000,
      ),
      deliver,
    );

    const upgrade = buildEvent(
      "customer.subscription.updated",
      buildSubscription({ ...base, plan: "BUSINESS" }),
      2_000,
    );
    const older = buildEvent(
      "customer.subscription.updated",
      buildSubscription({ ...base, plan: "PRO" }),
      1_500,
    );

    expect((await sendEvent(upgrade, deliver)).outcome).toBe("applied");
    expect((await sendEvent(older, deliver)).outcome).toBe("stale");
    expect(await orgPlan(org.id)).toBe("BUSINESS");
  });

  it("depois de 'deleted', nenhum evento reativa a assinatura", async () => {
    const org = await makeOrg();
    const base = {
      id: "sub_ordem_2",
      orgId: org.id,
      customer: "cus_ordem2",
      plan: "PRO" as const,
      created: 1_000,
    };
    await sendEvent(
      buildEvent(
        "customer.subscription.created",
        buildSubscription(base),
        1_000,
      ),
      deliver,
    );
    await sendEvent(
      buildEvent(
        "customer.subscription.deleted",
        buildSubscription({ ...base, status: "canceled" }),
        3_000,
      ),
      deliver,
    );
    const late = buildEvent(
      "customer.subscription.updated",
      buildSubscription(base),
      3_000,
    );
    expect((await sendEvent(late, deliver)).outcome).toBe("stale");
    expect(await orgPlan(org.id)).toBe("FREE");
  });

  it("'updated' que chega antes do 'created' cria a assinatura; o 'created' atrasado é ignorado", async () => {
    const org = await makeOrg();
    const base = {
      id: "sub_ordem_3",
      orgId: org.id,
      customer: "cus_ordem3",
      created: 1_000,
    };
    const created = buildEvent(
      "customer.subscription.created",
      buildSubscription({ ...base, plan: "PRO" }),
      1_000,
    );
    const updated = buildEvent(
      "customer.subscription.updated",
      buildSubscription({ ...base, plan: "BUSINESS" }),
      1_200,
    );
    expect((await sendEvent(updated, deliver)).outcome).toBe("applied");
    expect((await sendEvent(created, deliver)).outcome).toBe("stale");
    expect(await orgPlan(org.id)).toBe("BUSINESS");
  });

  it("cancelamento atrasado de uma assinatura antiga não derruba a nova", async () => {
    const org = await makeOrg();
    await sendEvent(
      buildEvent(
        "customer.subscription.created",
        buildSubscription({
          id: "sub_nova",
          orgId: org.id,
          customer: "cus_v",
          plan: "BUSINESS",
        }),
      ),
      deliver,
    );
    await sendEvent(
      buildEvent(
        "customer.subscription.deleted",
        buildSubscription({
          id: "sub_velha",
          orgId: org.id,
          customer: "cus_v",
          plan: "PRO",
          status: "canceled",
        }),
      ),
      deliver,
    );
    expect(await orgPlan(org.id)).toBe("BUSINESS");
  });

  it("evento de outra conta (org desconhecida) é ignorado sem erro", async () => {
    const event = buildEvent(
      "customer.subscription.created",
      buildSubscription({
        orgId: "nao-existe",
        customer: "cus_desconhecido",
        plan: "PRO",
      }),
    );
    expect((await sendEvent(event, deliver)).outcome).toBe("ignored");
  });
});

describe("fluxo de assinatura (checkout → upgrade → downgrade → cancelamento)", () => {
  it("só o dono mexe na cobrança, e o plano só muda pelo webhook", async () => {
    const org = await makeOrg();
    const { user: owner } = await addMember(org.id, "owner");
    const { user: admin } = await addMember(org.id, "admin");
    const ctx = { orgSlug: org.slug, deliver };

    await expect(
      completeFakeCheckout({ ...ctx, actorId: admin.id, plan: "PRO" }),
    ).rejects.toMatchObject({
      code: "forbidden",
    });

    await completeFakeCheckout({ ...ctx, actorId: owner.id, plan: "PRO" });
    expect(await orgPlan(org.id)).toBe("PRO");
    await expect(
      completeFakeCheckout({ ...ctx, actorId: owner.id, plan: "PRO" }),
    ).rejects.toMatchObject({
      code: "conflict",
    });

    expect(
      (await changePlan({ ...ctx, actorId: owner.id, plan: "BUSINESS" }))
        .direction,
    ).toBe("upgrade");
    expect(await orgPlan(org.id)).toBe("BUSINESS");
    expect(
      (await changePlan({ ...ctx, actorId: owner.id, plan: "PRO" })).direction,
    ).toBe("downgrade");
    expect(await orgPlan(org.id)).toBe("PRO");

    // Cancelar no fim do período mantém o plano até lá.
    await setCancelAtPeriodEnd({ ...ctx, actorId: owner.id, cancel: true });
    expect(await orgPlan(org.id)).toBe("PRO");
    const sub = await db.subscription.findFirstOrThrow({
      where: { orgId: org.id },
    });
    expect(sub.cancelAtPeriodEnd).toBe(true);

    await endPeriodNow({ ...ctx, actorId: owner.id });
    expect(await orgPlan(org.id)).toBe("FREE");
    const canceled = await db.subscription.findFirstOrThrow({
      where: { orgId: org.id },
    });
    expect(canceled.status).toBe("canceled");
    expect(canceled.canceledAt).not.toBeNull();
  });
});
