import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { QuoteDocument } from "@/components/quote-document";
import { Badge, Card } from "@/components/ui";
import { DomainError } from "@/lib/errors";
import { getPlan } from "@/lib/plans";
import { getQuote, QUOTE_STATUS, type QuoteStatus } from "@/lib/quotes";
import { can } from "@/lib/rbac";
import { appUrl, requireUser } from "@/lib/session";
import { deleteQuoteAction, markSentAction } from "../actions";
import { CopyLink } from "./copy-link";

export const metadata: Metadata = { title: "Orçamento" };

export default async function QuoteDetailPage({
  params,
}: PageProps<"/app/[org]/orcamentos/[id]">) {
  const { org: slug, id } = await params;
  const user = await requireUser(`/app/${slug}`);
  let found;
  try {
    found = await getQuote(user.id, slug, id);
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
  const { org, role, quote } = found;
  const status =
    QUOTE_STATUS[quote.status as QuoteStatus] ?? QUOTE_STATUS.DRAFT;
  const publicUrl = `${appUrl()}/p/${quote.publicToken}`;
  const canWrite = can(role, "quote:write");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <div>
        <Link
          href={`/app/${slug}`}
          className="mb-4 inline-block text-sm text-slate-600 hover:underline"
        >
          ← Orçamentos
        </Link>
        <QuoteDocument
          orgName={org.name}
          brandColor={getPlan(org.plan).customBranding ? org.brandColor : null}
          quote={quote}
        />
      </div>
      <aside className="space-y-4 lg:pt-9">
        <Card>
          <p className="text-sm text-slate-500">Situação</p>
          <div className="mt-1">
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          {quote.acceptedAt && (
            <p className="mt-2 text-sm text-emerald-700">
              Aprovado pelo cliente em{" "}
              {quote.acceptedAt.toLocaleString("pt-BR")}
            </p>
          )}
        </Card>
        <Card>
          <p className="mb-2 text-sm font-semibold">Link para o cliente</p>
          <CopyLink url={publicUrl} />
          <a
            href={`/p/${quote.publicToken}`}
            className="text-brand-600 mt-2 inline-block text-sm font-semibold hover:underline"
          >
            Ver como o cliente vê →
          </a>
          {canWrite && quote.status === "DRAFT" && (
            <ActionForm action={markSentAction} className="mt-4">
              <input type="hidden" name="orgSlug" value={slug} />
              <input type="hidden" name="quoteId" value={quote.id} />
              <SubmitButton variant="secondary" className="w-full">
                Marcar como enviado
              </SubmitButton>
            </ActionForm>
          )}
        </Card>
        {canWrite && (
          <ActionForm action={deleteQuoteAction}>
            <input type="hidden" name="orgSlug" value={slug} />
            <input type="hidden" name="quoteId" value={quote.id} />
            <SubmitButton variant="danger" className="w-full">
              Apagar orçamento
            </SubmitButton>
          </ActionForm>
        )}
      </aside>
    </div>
  );
}
