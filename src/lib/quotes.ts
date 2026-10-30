import { randomBytes } from "node:crypto";
import { z } from "zod";
import { track } from "@/lib/analytics";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { parseMoneyToCents, quoteTotal } from "@/lib/money";
import { getOrgAccess } from "@/lib/orgs";
import { canCreateQuote, getPlan } from "@/lib/plans";
import { quotesThisMonth } from "@/lib/usage";

export const QUOTE_STATUS = {
  DRAFT: { label: "Rascunho", tone: "slate" },
  SENT: { label: "Enviado", tone: "blue" },
  ACCEPTED: { label: "Aprovado", tone: "green" },
} as const;

export type QuoteStatus = keyof typeof QUOTE_STATUS;

export const quoteInputSchema = z.object({
  title: z.string().trim().min(2, "Dê um título ao orçamento.").max(120),
  clientName: z.string().trim().min(2, "Informe o nome do cliente.").max(120),
  clientEmail: z
    .string()
    .trim()
    .max(160)
    .refine(
      (v) => v === "" || z.email().safeParse(v).success,
      "E-mail do cliente inválido.",
    )
    .transform((v) => v || null),
  notes: z
    .string()
    .trim()
    .max(2000)
    .transform((v) => v || null),
  validDays: z.coerce.number().int().min(1).max(180),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1, "Descreva cada item.").max(200),
        quantity: z.coerce
          .number()
          .int()
          .min(1, "Quantidade mínima é 1.")
          .max(100_000),
        unitCents: z.coerce.number().int().min(0).max(100_000_000),
      }),
    )
    .min(1, "Adicione pelo menos um item.")
    .max(50),
});

export type QuoteInput = z.input<typeof quoteInputSchema>;

export { parseMoneyToCents, quoteTotal };

export async function createQuote(
  actorId: string,
  orgSlug: string,
  input: QuoteInput,
) {
  const { org } = await getOrgAccess(actorId, orgSlug, "quote:write");
  const parsed = quoteInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new DomainError(
      "invalid",
      parsed.error.issues[0]?.message ?? "Dados inválidos.",
    );
  }
  const limit = canCreateQuote(
    getPlan(org.plan),
    await quotesThisMonth(org.id),
  );
  if (!limit.ok) throw new DomainError("limit", limit.reason);

  const data = parsed.data;
  const quote = await db.$transaction(async (tx) => {
    const last = await tx.quote.findFirst({
      where: { orgId: org.id },
      orderBy: { number: "desc" },
      select: { number: true },
    });
    return tx.quote.create({
      data: {
        orgId: org.id,
        number: (last?.number ?? 0) + 1,
        title: data.title,
        clientName: data.clientName,
        clientEmail: data.clientEmail,
        notes: data.notes,
        validUntil: new Date(Date.now() + data.validDays * 86_400_000),
        publicToken: randomBytes(18).toString("base64url"),
        createdById: actorId,
        items: {
          create: data.items.map((item, position) => ({ ...item, position })),
        },
      },
    });
  });
  await track("quote.created", { userId: actorId, orgId: org.id });
  return quote;
}

export async function getQuote(
  actorId: string,
  orgSlug: string,
  quoteId: string,
) {
  const { org, role } = await getOrgAccess(actorId, orgSlug, "quote:read");
  const quote = await db.quote.findFirst({
    where: { id: quoteId, orgId: org.id },
    include: { items: { orderBy: { position: "asc" } } },
  });
  if (!quote) throw new DomainError("not_found", "Orçamento não encontrado.");
  return { org, role, quote };
}

export async function markQuoteSent(
  actorId: string,
  orgSlug: string,
  quoteId: string,
) {
  const { org, quote } = await getQuote(actorId, orgSlug, quoteId);
  await getOrgAccess(actorId, orgSlug, "quote:write");
  if (quote.status !== "DRAFT") return;
  await db.quote.update({ where: { id: quote.id }, data: { status: "SENT" } });
  await track("quote.sent", { userId: actorId, orgId: org.id });
}

export async function deleteQuote(
  actorId: string,
  orgSlug: string,
  quoteId: string,
) {
  const { org, quote } = await getQuote(actorId, orgSlug, quoteId);
  await getOrgAccess(actorId, orgSlug, "quote:write");
  await db.quote.delete({ where: { id: quote.id } });
  await audit({
    orgId: org.id,
    actorId,
    action: "quote.deleted",
    target: `#${quote.number} · ${quote.clientName}`,
    metadata: { title: quote.title, status: quote.status },
  });
}

export async function getPublicQuote(token: string) {
  return db.quote.findUnique({
    where: { publicToken: token },
    include: {
      items: { orderBy: { position: "asc" } },
      org: { select: { name: true, plan: true, brandColor: true } },
    },
  });
}

/** O cliente aprova pelo link público (sem login). */
export async function acceptPublicQuote(token: string) {
  const quote = await db.quote.findUnique({ where: { publicToken: token } });
  if (!quote) throw new DomainError("not_found", "Orçamento não encontrado.");
  if (quote.status === "ACCEPTED") return quote;
  if (quote.validUntil < new Date()) {
    throw new DomainError(
      "invalid",
      "Este orçamento venceu. Peça uma versão atualizada.",
    );
  }
  const updated = await db.quote.update({
    where: { id: quote.id },
    data: { status: "ACCEPTED", acceptedAt: new Date() },
  });
  await track("quote.accepted", { orgId: quote.orgId });
  return updated;
}

const HEX = /^#[0-9a-f]{6}$/i;

export async function setBrandColor(
  actorId: string,
  orgSlug: string,
  color: string,
) {
  const { org } = await getOrgAccess(actorId, orgSlug, "org:settings");
  if (!getPlan(org.plan).customBranding) {
    throw new DomainError(
      "limit",
      "A cor da marca está disponível a partir do plano Pro.",
    );
  }
  if (!HEX.test(color)) throw new DomainError("invalid", "Cor inválida.");
  await db.organization.update({
    where: { id: org.id },
    data: { brandColor: color },
  });
  await audit({
    orgId: org.id,
    actorId,
    action: "org.settings_updated",
    metadata: { brandColor: { from: org.brandColor, to: color } },
  });
}
