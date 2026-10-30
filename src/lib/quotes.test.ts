import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  acceptPublicQuote,
  createQuote,
  deleteQuote,
  parseMoneyToCents,
  quoteTotal,
  setBrandColor,
  type QuoteInput,
} from "@/lib/quotes";
import { addMember, makeOrg } from "@/test/factories";

const input: QuoteInput = {
  title: "Armário planejado",
  clientName: "Carla Souza",
  clientEmail: "carla@cliente.dev",
  notes: "",
  validDays: 15,
  items: [
    { description: "Armário de cozinha", quantity: 1, unitCents: 350_000 },
    { description: "Instalação", quantity: 2, unitCents: 15_000 },
  ],
};

describe("utilitários", () => {
  it("soma quantidade × preço", () => {
    expect(
      quoteTotal(input.items as { quantity: number; unitCents: number }[]),
    ).toBe(380_000);
  });

  it("entende valores em reais escritos de vários jeitos", () => {
    expect(parseMoneyToCents("1.234,56")).toBe(123_456);
    expect(parseMoneyToCents("R$ 89,90")).toBe(8_990);
    expect(parseMoneyToCents("150")).toBe(15_000);
    expect(parseMoneyToCents("12.5")).toBe(1_250);
  });
});

describe("orçamentos", () => {
  it("numera em sequência por empresa e valida os dados", async () => {
    const org = await makeOrg("PRO");
    const { user } = await addMember(org.id, "member");
    const a = await createQuote(user.id, org.slug, input);
    const b = await createQuote(user.id, org.slug, input);
    expect([a.number, b.number]).toEqual([1, 2]);

    await expect(
      createQuote(user.id, org.slug, { ...input, items: [] }),
    ).rejects.toMatchObject({
      code: "invalid",
      message: "Adicione pelo menos um item.",
    });
  });

  it("plano Grátis: o 6º orçamento do mês é bloqueado no servidor", async () => {
    const org = await makeOrg("FREE");
    const { user } = await addMember(org.id, "owner");
    for (let i = 0; i < 5; i++) await createQuote(user.id, org.slug, input);
    await expect(createQuote(user.id, org.slug, input)).rejects.toMatchObject({
      code: "limit",
    });
  });

  it("leitor não cria nem apaga orçamentos", async () => {
    const org = await makeOrg("PRO");
    const { user: member } = await addMember(org.id, "member");
    const { user: viewer } = await addMember(org.id, "viewer");
    const quote = await createQuote(member.id, org.slug, input);
    await expect(createQuote(viewer.id, org.slug, input)).rejects.toMatchObject(
      { code: "forbidden" },
    );
    await expect(
      deleteQuote(viewer.id, org.slug, quote.id),
    ).rejects.toMatchObject({ code: "forbidden" });
  });

  it("apagar fica na auditoria", async () => {
    const org = await makeOrg("PRO");
    const { user } = await addMember(org.id, "admin");
    const quote = await createQuote(user.id, org.slug, input);
    await deleteQuote(user.id, org.slug, quote.id);
    const log = await db.auditLog.findFirst({
      where: { orgId: org.id, action: "quote.deleted" },
    });
    expect(log?.actorId).toBe(user.id);
    expect(log?.target).toContain("Carla Souza");
  });

  it("o cliente aprova pelo link público; orçamento vencido não pode ser aprovado", async () => {
    const org = await makeOrg("PRO");
    const { user } = await addMember(org.id, "member");
    const quote = await createQuote(user.id, org.slug, input);
    const accepted = await acceptPublicQuote(quote.publicToken);
    expect(accepted.status).toBe("ACCEPTED");

    const old = await createQuote(user.id, org.slug, input);
    await db.quote.update({
      where: { id: old.id },
      data: { validUntil: new Date(Date.now() - 1000) },
    });
    await expect(acceptPublicQuote(old.publicToken)).rejects.toMatchObject({
      code: "invalid",
    });
  });

  it("orçamento de outra empresa é invisível (não encontrado)", async () => {
    const orgA = await makeOrg("PRO");
    const orgB = await makeOrg("PRO");
    const { user: a } = await addMember(orgA.id, "owner");
    const { user: b } = await addMember(orgB.id, "owner");
    const quote = await createQuote(a.id, orgA.slug, input);
    await expect(deleteQuote(b.id, orgB.slug, quote.id)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("cor da marca (feature gating)", () => {
  it("só a partir do Pro, e só admin ou dono", async () => {
    const free = await makeOrg("FREE");
    const { user: freeOwner } = await addMember(free.id, "owner");
    await expect(
      setBrandColor(freeOwner.id, free.slug, "#ff6600"),
    ).rejects.toMatchObject({ code: "limit" });

    const pro = await makeOrg("PRO");
    const { user: member } = await addMember(pro.id, "member");
    const { user: admin } = await addMember(pro.id, "admin");
    await expect(
      setBrandColor(member.id, pro.slug, "#ff6600"),
    ).rejects.toMatchObject({ code: "forbidden" });
    await setBrandColor(admin.id, pro.slug, "#ff6600");
    expect(
      (await db.organization.findUniqueOrThrow({ where: { id: pro.id } }))
        .brandColor,
    ).toBe("#ff6600");
  });
});
