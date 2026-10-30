import Link from "next/link";
import { Badge, Card, LinkButton, PageHeader } from "@/components/ui";
import { db } from "@/lib/db";
import { quoteTotal } from "@/lib/money";
import { canCreateQuote, formatBRL, getPlan } from "@/lib/plans";
import { QUOTE_STATUS, type QuoteStatus } from "@/lib/quotes";
import { can } from "@/lib/rbac";
import { requireOrgPage } from "@/lib/session";
import { quotesThisMonth } from "@/lib/usage";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default async function QuotesPage({ params }: PageProps<"/app/[org]">) {
  const { org: slug } = await params;
  const { org, role } = await requireOrgPage(slug);
  const plan = getPlan(org.plan);
  const [quotes, monthCount] = await Promise.all([
    db.quote.findMany({
      where: { orgId: org.id },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    quotesThisMonth(org.id),
  ]);
  const withTotals = quotes.map((q) => ({ ...q, total: quoteTotal(q.items) }));
  const accepted = withTotals.filter((q) => q.status === "ACCEPTED");
  const decided = withTotals.filter((q) => q.status !== "DRAFT").length;
  const limit = canCreateQuote(plan, monthCount);
  const canWrite = can(role, "quote:write");

  return (
    <>
      <PageHeader
        title="Orçamentos"
        description={`Orçamentos de ${org.name}.`}
        action={
          canWrite &&
          (limit.ok ? (
            <LinkButton href={`/app/${slug}/orcamentos/novo`}>
              + Novo orçamento
            </LinkButton>
          ) : (
            <LinkButton href={`/app/${slug}/plano`} variant="secondary">
              Limite do mês atingido · ver planos
            </LinkButton>
          ))
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Stat
          label="Criados este mês"
          value={
            Number.isFinite(plan.quotesPerMonth)
              ? `${monthCount} de ${plan.quotesPerMonth}`
              : String(monthCount)
          }
        />
        <Stat
          label="Valor aprovado"
          value={formatBRL(accepted.reduce((s, q) => s + q.total, 0))}
        />
        <Stat
          label="Taxa de aprovação"
          value={
            decided ? `${Math.round((accepted.length / decided) * 100)}%` : "—"
          }
        />
      </div>

      <Card className="p-0">
        {withTotals.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-semibold">Nenhum orçamento ainda</p>
            <p className="mt-1 text-sm text-slate-600">
              Crie o primeiro e mande o link para o seu cliente.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {withTotals.map((q) => {
              const status =
                QUOTE_STATUS[q.status as QuoteStatus] ?? QUOTE_STATUS.DRAFT;
              return (
                <li key={q.id}>
                  <Link
                    href={`/app/${slug}/orcamentos/${q.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">
                        <span className="text-slate-400">#{q.number}</span>{" "}
                        {q.title}
                      </p>
                      <p className="text-sm text-slate-500">
                        {q.clientName} ·{" "}
                        {q.createdAt.toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">
                        {formatBRL(q.total)}
                      </span>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
