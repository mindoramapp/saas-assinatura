import type { Metadata } from "next";
import Link from "next/link";
import { Card, LinkButton, PageHeader } from "@/components/ui";
import { canCreateQuote, getPlan } from "@/lib/plans";
import { requireOrgPage } from "@/lib/session";
import { quotesThisMonth } from "@/lib/usage";
import { QuoteForm } from "./quote-form";

export const metadata: Metadata = { title: "Novo orçamento" };

export default async function NewQuotePage({
  params,
}: PageProps<"/app/[org]/orcamentos/novo">) {
  const { org: slug } = await params;
  const { org } = await requireOrgPage(slug, "quote:write");
  const limit = canCreateQuote(
    getPlan(org.plan),
    await quotesThisMonth(org.id),
  );

  return (
    <>
      <PageHeader
        title="Novo orçamento"
        action={
          <Link
            href={`/app/${slug}`}
            className="text-sm text-slate-600 hover:underline"
          >
            Cancelar
          </Link>
        }
      />
      <Card>
        {limit.ok ? (
          <QuoteForm orgSlug={slug} />
        ) : (
          <div className="text-center">
            <p className="mb-4 text-slate-700">{limit.reason}</p>
            <LinkButton href={`/app/${slug}/plano`}>Ver planos</LinkButton>
          </div>
        )}
      </Card>
    </>
  );
}
