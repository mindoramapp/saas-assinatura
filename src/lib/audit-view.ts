import { AUDIT_LABELS } from "@/lib/audit";
import { db } from "@/lib/db";

export async function listAuditLogs(orgId: string, take = 100) {
  const logs = await db.auditLog.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
    take,
  });
  const actorIds = [
    ...new Set(logs.map((l) => l.actorId).filter((id): id is string => !!id)),
  ];
  const actors = await db.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true, email: true },
  });
  const byId = new Map(actors.map((a) => [a.id, a]));
  return logs.map((log) => ({
    ...log,
    label: AUDIT_LABELS[log.action] ?? log.action,
    actor: log.actorId
      ? (byId.get(log.actorId)?.name ?? "Usuário removido")
      : "Sistema (Stripe)",
    actorEmail: log.actorId ? (byId.get(log.actorId)?.email ?? "") : "",
    details: describe(log.metadata),
  }));
}

function describe(metadata: string): string {
  try {
    const data = JSON.parse(metadata) as Record<string, unknown>;
    return Object.entries(data)
      .map(
        ([key, value]) =>
          `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`,
      )
      .join(" · ");
  } catch {
    return "";
  }
}

/** CSV com aspas escapadas e proteção contra injeção de fórmula em planilhas. */
export function toCsv(rows: string[][]): string {
  const cell = (value: string) => {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
