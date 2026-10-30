/**
 * Dados de demonstração (npm run db:seed). Credenciais só de teste local:
 *   demo@orcai.dev  / demo-orcai-2026  → dono da "Marcenaria Bom Lar" (Pro)
 *   admin@orcai.dev / admin-orcai-2026 → vê o painel /admin (PLATFORM_ADMIN_EMAILS)
 * Também cria ~60 empresas fictícias com 12 meses de assinaturas e uso, para o
 * painel de métricas ter história.
 */
import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { auth } from "@/lib/auth";
import { handleStripeEvent } from "@/lib/billing/webhook";
import { buildEvent, buildSubscription } from "@/lib/billing/fake-stripe";
import { db } from "@/lib/db";
import { PLANS } from "@/lib/plans";

const DAY = 86_400_000;
const now = Date.now();

// PRNG determinístico: o seed gera sempre a mesma história.
let state = 20261030;
function rand() {
  state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
  return state / 2 ** 31;
}
const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;

async function signUp(name: string, email: string, password: string) {
  const result = await auth.api.signUpEmail({
    body: { name, email, password },
  });
  return result.user;
}

async function demoCompany() {
  const owner = await signUp(
    "Marta Oliveira",
    "demo@orcai.dev",
    "demo-orcai-2026",
  );
  const org = await db.organization.create({
    data: {
      name: "Marcenaria Bom Lar",
      slug: "marcenaria-bom-lar",
      brandColor: "#b45309",
      createdAt: new Date(now - 120 * DAY),
      memberships: { create: { userId: owner.id, role: "owner" } },
    },
  });
  // O plano Pro chega pelo mesmo caminho da produção: um evento do Stripe.
  await handleStripeEvent(
    buildEvent(
      "customer.subscription.created",
      buildSubscription({
        orgId: org.id,
        customer: `cus_fake_${org.id}`,
        plan: "PRO",
        created: Math.floor((now - 90 * DAY) / 1000),
      }),
    ) as never,
  );

  const team = [
    ["João Pereira", "joao@marcenariabomlar.dev", "admin"],
    ["Bia Santos", "bia@marcenariabomlar.dev", "member"],
    ["Contador Silva", "contador@marcenariabomlar.dev", "viewer"],
  ] as const;
  for (const [name, email, role] of team) {
    const user = await db.user.create({
      data: { id: randomUUID(), name, email },
    });
    await db.membership.create({
      data: { orgId: org.id, userId: user.id, role },
    });
    await db.auditLog.create({
      data: {
        orgId: org.id,
        actorId: user.id,
        action: "member.joined",
        target: email,
        metadata: JSON.stringify({ role }),
      },
    });
  }

  const quotes = [
    [
      "Cozinha planejada",
      "Carla Souza",
      "ACCEPTED",
      [
        ["Armários em MDF", 1, 1_250_000],
        ["Instalação", 1, 180_000],
      ],
    ],
    [
      "Guarda-roupa casal",
      "Rafael Lima",
      "SENT",
      [
        ["Guarda-roupa 6 portas", 1, 690_000],
        ["Puxadores em alumínio", 6, 4_500],
      ],
    ],
    [
      "Estante da sala",
      "Paula Mendes",
      "ACCEPTED",
      [["Estante com nichos", 1, 320_000]],
    ],
    [
      "Bancada do escritório",
      "Studio Ana Arquitetura",
      "DRAFT",
      [
        ["Bancada 2,4 m", 1, 210_000],
        ["Gaveteiro", 2, 65_000],
      ],
    ],
    [
      "Painel para TV",
      "Lucas Rocha",
      "ACCEPTED",
      [
        ["Painel ripado", 1, 185_000],
        ["Iluminação LED", 1, 32_000],
      ],
    ],
  ] as const;
  for (const [index, [title, clientName, status, items]] of quotes.entries()) {
    const createdAt = new Date(now - (20 - index * 4) * DAY);
    await db.quote.create({
      data: {
        orgId: org.id,
        number: index + 1,
        title,
        clientName,
        status,
        createdById: owner.id,
        createdAt,
        validUntil: new Date(createdAt.getTime() + 30 * DAY),
        acceptedAt:
          status === "ACCEPTED"
            ? new Date(createdAt.getTime() + 2 * DAY)
            : null,
        publicToken: randomBytes(18).toString("base64url"),
        notes:
          "Pagamento: 50% na aprovação e 50% na entrega. Prazo: 20 dias úteis.",
        items: {
          create: items.map(([description, quantity, unitCents], position) => ({
            description,
            quantity,
            unitCents,
            position,
          })),
        },
      },
    });
  }
  return owner;
}

const BUSINESSES = [
  "Doceria",
  "Oficina",
  "Studio",
  "Clínica",
  "Pet Shop",
  "Gráfica",
  "Buffet",
  "Estúdio",
  "Ateliê",
  "Reformas",
];
const NAMES = [
  "Sol",
  "Aurora",
  "Bem-Estar",
  "Central",
  "Nova Era",
  "Primavera",
  "Raiz",
  "Horizonte",
  "Bela Vista",
  "Cia",
];

/** Empresas fictícias com assinaturas e uso espalhados em 12 meses. */
async function history() {
  for (let i = 0; i < 60; i++) {
    const createdAt = now - Math.floor(rand() * 360 + 1) * DAY;
    const user = await db.user.create({
      data: {
        id: randomUUID(),
        name: `Cliente ${i + 1}`,
        email: `cliente${i + 1}@exemplo.dev`,
        createdAt: new Date(createdAt),
      },
    });
    const org = await db.organization.create({
      data: {
        name: `${pick(BUSINESSES)} ${pick(NAMES)} ${i + 1}`,
        slug: `empresa-ficticia-${i + 1}`,
        createdAt: new Date(createdAt),
        memberships: { create: { userId: user.id, role: "owner" } },
      },
    });
    await db.analyticsEvent.create({
      data: {
        name: "org.created",
        userId: user.id,
        orgId: org.id,
        createdAt: new Date(createdAt),
      },
    });
    // ~70% ativam (1º orçamento em até 7 dias).
    if (rand() < 0.7) {
      await db.analyticsEvent.create({
        data: {
          name: "quote.created",
          userId: user.id,
          orgId: org.id,
          createdAt: new Date(createdAt + rand() * 6 * DAY),
        },
      });
    }
    // Logins espalhados: quem é mais recente usa mais.
    const logins = Math.floor(rand() * 25);
    for (let l = 0; l < logins; l++) {
      const at = now - rand() * Math.min(60, (now - createdAt) / DAY) * DAY;
      await db.analyticsEvent.create({
        data: {
          name: "user.signed_in",
          userId: user.id,
          createdAt: new Date(at),
        },
      });
    }

    // ~45% assinam; desses, ~25% cancelam depois.
    if (rand() < 0.45) {
      const plan = rand() < 0.75 ? "PRO" : "BUSINESS";
      const start = Math.min(createdAt + rand() * 20 * DAY, now - DAY);
      const canceled = rand() < 0.25 ? start + (15 + rand() * 120) * DAY : null;
      const canceledAt = canceled && canceled < now ? new Date(canceled) : null;
      await db.subscription.create({
        data: {
          id: `sub_fake_hist_${i}`,
          orgId: org.id,
          customerId: `cus_fake_${org.id}`,
          plan,
          status: canceledAt ? "canceled" : "active",
          priceCents: PLANS[plan].priceCents,
          createdAt: new Date(start),
          canceledAt,
          currentPeriodEnd: new Date(now + 15 * DAY),
          lastEventAt: canceledAt ?? new Date(start),
        },
      });
      if (!canceledAt)
        await db.organization.update({ where: { id: org.id }, data: { plan } });
    }
  }
}

async function main() {
  if (await db.user.findUnique({ where: { email: "demo@orcai.dev" } })) {
    console.log("O banco já tem os dados de demonstração. Nada a fazer.");
    return;
  }
  const owner = await demoCompany();
  await signUp("Admin da Plataforma", "admin@orcai.dev", "admin-orcai-2026");
  await history();
  // Logins recentes da conta demo.
  for (let d = 0; d < 20; d += 2) {
    await db.analyticsEvent.create({
      data: {
        name: "user.signed_in",
        userId: owner.id,
        createdAt: new Date(now - d * DAY),
      },
    });
  }
  console.log(
    "Pronto: demo@orcai.dev / demo-orcai-2026 e admin@orcai.dev / admin-orcai-2026",
  );
}

main().finally(() => db.$disconnect());
