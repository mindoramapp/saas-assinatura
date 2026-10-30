import { db } from "@/lib/db";

/** Eventos de produto usados nas métricas de ativação e usuários ativos. */
export type AnalyticsEventName =
  | "user.signed_in"
  | "org.created"
  | "quote.created"
  | "quote.sent"
  | "quote.accepted"
  | "member.joined";

export async function track(
  name: AnalyticsEventName,
  ids: { userId?: string | null; orgId?: string | null } = {},
) {
  await db.analyticsEvent.create({
    data: { name, userId: ids.userId ?? null, orgId: ids.orgId ?? null },
  });
}
