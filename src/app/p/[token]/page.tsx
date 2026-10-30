import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { QuoteDocument } from "@/components/quote-document";
import { getPlan } from "@/lib/plans";
import { getPublicQuote } from "@/lib/quotes";
import { acceptQuoteAction } from "./actions";

export const metadata: Metadata = {
  title: "Orçamento",
  robots: { index: false },
};

export default function PublicQuotePage({ params }: PageProps<"/p/[token]">) {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:py-12">
      <Suspense
        fallback={
          <p className="text-center text-sm text-slate-500">
            Carregando orçamento…
          </p>
        }
      >
        <PublicQuote params={params} />
      </Suspense>
      <p className="mt-8 text-center text-xs text-slate-400">Feito com Orçaí</p>
    </main>
  );
}

async function PublicQuote({
  params,
}: Pick<PageProps<"/p/[token]">, "params">) {
  const { token } = await params;
  const quote = await getPublicQuote(token);
  if (!quote) notFound();
  // A cor própria só vale enquanto o plano da empresa permitir.
  const brandColor = getPlan(quote.org.plan).customBranding
    ? quote.org.brandColor
    : null;
  const expired = quote.validUntil < new Date();

  const footer =
    quote.status === "ACCEPTED" ? (
      <p
        role="status"
        className="rounded-xl bg-emerald-50 px-4 py-4 text-center font-semibold text-emerald-800"
      >
        ✓ Orçamento aprovado em {quote.acceptedAt?.toLocaleDateString("pt-BR")}.{" "}
        {quote.org.name} já foi avisada!
      </p>
    ) : expired ? (
      <p className="rounded-xl bg-amber-50 px-4 py-4 text-center text-sm text-amber-800">
        Este orçamento venceu. Peça uma versão atualizada para {quote.org.name}.
      </p>
    ) : (
      <ActionForm action={acceptQuoteAction}>
        <input type="hidden" name="token" value={token} />
        <SubmitButton className="w-full py-3 text-base">
          Aprovar orçamento
        </SubmitButton>
      </ActionForm>
    );

  return (
    <QuoteDocument
      orgName={quote.org.name}
      brandColor={brandColor}
      quote={quote}
      footer={footer}
    />
  );
}
