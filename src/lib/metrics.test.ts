import { describe, expect, it } from "vitest";
import {
  activation,
  activeUsers,
  churn,
  dailyActiveSeries,
  mrrAt,
  mrrSeries,
} from "./metrics";

const now = new Date("2026-10-30T12:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
const sub = (
  price: number,
  startedDaysAgo: number,
  canceledDaysAgo?: number,
) => ({
  priceCents: price,
  plan: price === 4900 ? "PRO" : "BUSINESS",
  status: canceledDaysAgo === undefined ? "active" : "canceled",
  createdAt: daysAgo(startedDaysAgo),
  canceledAt: canceledDaysAgo === undefined ? null : daysAgo(canceledDaysAgo),
});

describe("MRR", () => {
  const subs = [sub(4900, 100), sub(12900, 50), sub(4900, 200, 10)];

  it("soma só as assinaturas ativas na data", () => {
    expect(mrrAt(subs, now)).toBe(4900 + 12900);
    expect(mrrAt(subs, daysAgo(20))).toBe(4900 + 12900 + 4900);
    expect(mrrAt(subs, daysAgo(150))).toBe(4900);
  });

  it("série de 12 meses termina no valor de hoje", () => {
    const series = mrrSeries(subs, now);
    expect(series).toHaveLength(12);
    expect(series.at(-1)!.value).toBe(mrrAt(subs, now));
  });
});

describe("churn", () => {
  it("1 de 4 clientes cancelou nos últimos 30 dias = 25%", () => {
    const subs = [
      sub(4900, 100),
      sub(4900, 100),
      sub(12900, 100),
      sub(4900, 100, 5),
      sub(4900, 10),
    ];
    const result = churn(subs, now);
    expect(result.activeAtStart).toBe(4);
    expect(result.customerRate).toBe(0.25);
    expect(result.revenueRate).toBeCloseTo(4900 / (4900 * 3 + 12900));
  });

  it("sem clientes no início, churn é zero (sem divisão por zero)", () => {
    expect(churn([], now).customerRate).toBe(0);
  });
});

describe("usuários ativos e ativação", () => {
  const events = [
    {
      name: "user.signed_in",
      userId: "a",
      orgId: null,
      createdAt: daysAgo(0.2),
    },
    { name: "user.signed_in", userId: "a", orgId: null, createdAt: daysAgo(3) },
    {
      name: "user.signed_in",
      userId: "b",
      orgId: null,
      createdAt: daysAgo(20),
    },
    {
      name: "user.signed_in",
      userId: "c",
      orgId: null,
      createdAt: daysAgo(45),
    },
    // org1 ativou em 2 dias; org2 nunca; org3 ativou em 10 dias (fora do prazo);
    // org4 tem 2 dias e ainda não criou (fica fora do denominador).
    { name: "org.created", userId: "a", orgId: "org1", createdAt: daysAgo(30) },
    {
      name: "quote.created",
      userId: "a",
      orgId: "org1",
      createdAt: daysAgo(28),
    },
    { name: "org.created", userId: "b", orgId: "org2", createdAt: daysAgo(40) },
    { name: "org.created", userId: "c", orgId: "org3", createdAt: daysAgo(60) },
    {
      name: "quote.created",
      userId: "c",
      orgId: "org3",
      createdAt: daysAgo(50),
    },
    { name: "org.created", userId: "d", orgId: "org4", createdAt: daysAgo(2) },
  ];

  it("DAU e MAU contam pessoas distintas", () => {
    expect(activeUsers(events, now, 1)).toBe(1);
    // a, b e d (que criou a org há 2 dias); c ficou de fora (45 dias).
    expect(activeUsers(events, now, 30)).toBe(3);
  });

  it("ativação = primeiro orçamento em até 7 dias", () => {
    expect(activation(events, now)).toEqual({
      rate: 1 / 3,
      activated: 1,
      eligible: 3,
    });
  });

  it("série diária tem um ponto por dia", () => {
    const series = dailyActiveSeries(events, now, 30);
    expect(series).toHaveLength(30);
    expect(series.at(-1)!.value).toBe(1);
  });
});
