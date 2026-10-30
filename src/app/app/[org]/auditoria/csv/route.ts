import { audit } from "@/lib/audit";
import { listAuditLogs, toCsv } from "@/lib/audit-view";
import { DomainError } from "@/lib/errors";
import { getOrgAccess } from "@/lib/orgs";
import { getPlan } from "@/lib/plans";
import { getCurrentUser } from "@/lib/session";

export async function GET(
  _: Request,
  { params }: RouteContext<"/app/[org]/auditoria/csv">,
) {
  const { org: slug } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Faça login.", { status: 401 });
  let access;
  try {
    access = await getOrgAccess(user.id, slug, "audit:read");
  } catch (error) {
    if (error instanceof DomainError) {
      return new Response(error.message, {
        status: error.code === "not_found" ? 404 : 403,
      });
    }
    throw error;
  }
  if (!getPlan(access.org.plan).auditExport) {
    return new Response("Exportação disponível no plano Business.", {
      status: 402,
    });
  }
  const logs = await listAuditLogs(access.org.id, 5000);
  await audit({
    orgId: access.org.id,
    actorId: user.id,
    action: "audit.exported",
    metadata: { rows: logs.length },
  });
  const csv = toCsv([
    ["data", "pessoa", "email", "acao", "alvo", "detalhes"],
    ...logs.map((l) => [
      l.createdAt.toISOString(),
      l.actor,
      l.actorEmail,
      l.action,
      l.target ?? "",
      l.details,
    ]),
  ]);
  return new Response(`﻿${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="auditoria-${slug}.csv"`,
    },
  });
}
