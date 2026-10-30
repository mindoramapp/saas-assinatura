import type { Metadata } from "next";
import Link from "next/link";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { listAuditLogs } from "@/lib/audit-view";
import { getPlan } from "@/lib/plans";
import { requireOrgPage } from "@/lib/session";

export const metadata: Metadata = { title: "Auditoria" };

export default async function AuditPage({
  params,
}: PageProps<"/app/[org]/auditoria">) {
  const { org: slug } = await params;
  const { org } = await requireOrgPage(slug, "audit:read");
  const logs = await listAuditLogs(org.id);
  const canExport = getPlan(org.plan).auditExport;

  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Registro das ações sensíveis: equipe, cobrança e exclusões."
        action={
          canExport ? (
            <LinkButton
              href={`/app/${slug}/auditoria/csv`}
              variant="secondary"
              prefetch={false}
            >
              Exportar CSV
            </LinkButton>
          ) : (
            <Link
              href={`/app/${slug}/plano`}
              className="text-sm text-slate-600 hover:underline"
            >
              Exportar CSV: plano Business
            </Link>
          )
        }
      />
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Quando</th>
              <th className="px-4 py-3 font-medium">Quem</th>
              <th className="px-4 py-3 font-medium">Ação</th>
              <th className="px-4 py-3 font-medium">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {logs.map((log) => (
              <tr key={log.id} className="align-top">
                <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                  {log.createdAt.toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3">
                  {log.actor}
                  {log.actorEmail && (
                    <span className="block text-xs text-slate-500">
                      {log.actorEmail}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium">
                  {log.label}
                  {log.target && (
                    <span className="block text-xs font-normal text-slate-500">
                      {log.target}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs break-all text-slate-600">
                  {log.details}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
