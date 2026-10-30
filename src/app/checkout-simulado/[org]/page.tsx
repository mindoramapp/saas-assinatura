import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { payFakeCheckoutAction } from "@/app/app/[org]/plano/actions";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { billingMode } from "@/lib/billing/stripe";
import { formatBRL, isPlanId, PLANS } from "@/lib/plans";
import { requireOrgPage } from "@/lib/session";

export const metadata: Metadata = { title: "Pagamento" };

export default function FakeCheckoutPage(
  props: PageProps<"/checkout-simulado/[org]">,
) {
  return (
    <main className="flex flex-1 items-center justify-center bg-slate-100 px-4 py-10">
      <Suspense
        fallback={<p className="text-sm text-slate-500">Abrindo o checkout…</p>}
      >
        <Checkout {...props} />
      </Suspense>
    </main>
  );
}

async function Checkout({
  params,
  searchParams,
}: PageProps<"/checkout-simulado/[org]">) {
  if (billingMode() !== "fake") notFound();
  const { org: slug } = await params;
  const { plano } = await searchParams;
  const { org, user } = await requireOrgPage(slug, "billing:manage");
  if (typeof plano !== "string" || !isPlanId(plano) || plano === "FREE")
    notFound();
  const plan = PLANS[plano];
  const price = formatBRL(plan.priceCents);

  return (
    <div className="grid w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl md:grid-cols-2">
      <section className="bg-slate-900 p-8 text-white">
        <Link
          href={`/app/${slug}/plano`}
          className="text-sm text-slate-300 hover:text-white"
        >
          ← Voltar
        </Link>
        <p className="mt-6 text-sm text-slate-300">Assinar Orçaí {plan.name}</p>
        <p className="mt-1 text-4xl font-extrabold">
          {price}
          <span className="text-base font-medium text-slate-300"> por mês</span>
        </p>
        <ul className="mt-6 space-y-2 text-sm text-slate-200">
          {plan.highlights.map((h) => (
            <li key={h}>✓ {h}</li>
          ))}
        </ul>
        <p className="mt-8 text-xs text-slate-400">Para: {org.name}</p>
      </section>
      <section className="p-8">
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Checkout simulado: nenhum cartão é cobrado.
        </p>
        <ActionForm action={payFakeCheckoutAction} className="space-y-4">
          <input type="hidden" name="orgSlug" value={slug} />
          <input type="hidden" name="plan" value={plan.id} />
          <label className="block text-sm">
            <span className="font-medium text-slate-700">E-mail</span>
            <input
              readOnly
              value={user.email}
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600"
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700">Cartão (teste)</span>
            <input
              readOnly
              value="4242 4242 4242 4242   12/34   123"
              className="mt-1 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-slate-600"
            />
          </label>
          <SubmitButton className="w-full py-3 text-base">
            Pagar {price}
          </SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}
