import type { Metadata } from "next";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, PageHeader } from "@/components/ui";
import { getActiveSubscription } from "@/lib/billing/billing";
import { billingMode } from "@/lib/billing/stripe";
import { comparePlans, formatBRL, getPlan, PLAN_IDS, PLANS } from "@/lib/plans";
import { can } from "@/lib/rbac";
import { requireOrgPage } from "@/lib/session";
import { countSeats } from "@/lib/team";
import { quotesThisMonth } from "@/lib/usage";
import {
  cancelAction,
  changePlanAction,
  checkoutAction,
  endPeriodAction,
} from "./actions";
import { noticeText } from "./notices";

export const metadata: Metadata = { title: "Plano" };

function Meter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number;
}) {
  const finite = Number.isFinite(limit);
  const pct = finite ? Math.min(100, Math.round((used / limit) * 100)) : 8;
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-600">
          {finite ? `${used} de ${limit}` : `${used} · ilimitado`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-100" role="presentation">
        <div
          className={`h-2 rounded-full ${pct >= 100 ? "bg-red-500" : "bg-brand-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function PlanPage({
  params,
  searchParams,
}: PageProps<"/app/[org]/plano">) {
  const { org: slug } = await params;
  const { aviso } = await searchParams;
  const { org, role } = await requireOrgPage(slug);
  const plan = getPlan(org.plan);
  const [sub, quotes, seats] = await Promise.all([
    getActiveSubscription(org.id),
    quotesThisMonth(org.id),
    countSeats(org.id),
  ]);
  const isOwner = can(role, "billing:manage");
  const fake = billingMode() === "fake";
  const notice = noticeText(aviso, plan.name);

  return (
    <>
      <PageHeader
        title="Plano e cobrança"
        description="Escolha o plano que acompanha o tamanho do seu negócio."
      />

      {notice && (
        <p
          role="status"
          className="mb-6 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
        >
          {notice}
        </p>
      )}

      <Card className="mb-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-500">Plano atual</p>
            <p className="text-2xl font-bold">
              {plan.name}{" "}
              <span className="text-base font-medium text-slate-500">
                {plan.priceCents
                  ? `${formatBRL(plan.priceCents)}/mês`
                  : "grátis"}
              </span>
            </p>
          </div>
          {sub && (
            <div className="text-right text-sm text-slate-600">
              {sub.cancelAtPeriodEnd ? (
                <Badge tone="amber">
                  Cancela em {sub.currentPeriodEnd?.toLocaleDateString("pt-BR")}
                </Badge>
              ) : (
                <Badge tone="green">
                  Renova em {sub.currentPeriodEnd?.toLocaleDateString("pt-BR")}
                </Badge>
              )}
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Meter
            label="Orçamentos este mês"
            used={quotes}
            limit={plan.quotesPerMonth}
          />
          <Meter label="Pessoas na equipe" used={seats} limit={plan.seats} />
        </div>
      </Card>

      {!isOwner && (
        <p className="mb-6 rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          Só o dono da empresa pode mudar o plano.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {PLAN_IDS.map((id) => {
          const p = PLANS[id];
          const current = id === plan.id;
          return (
            <Card key={id} className={current ? "ring-brand-500 ring-2" : ""}>
              <div className="flex items-center justify-between">
                <h2 className="font-bold">{p.name}</h2>
                {current && <Badge tone="blue">Atual</Badge>}
              </div>
              <p className="mt-2 text-2xl font-extrabold">
                {p.priceCents ? formatBRL(p.priceCents) : "R$ 0"}
                <span className="text-sm font-medium text-slate-500">/mês</span>
              </p>
              <ul className="mt-3 space-y-1 text-sm text-slate-700">
                {p.highlights.map((h) => (
                  <li key={h}>✓ {h}</li>
                ))}
              </ul>
              {isOwner && !current && id !== "FREE" && (
                <ActionForm
                  action={sub ? changePlanAction : checkoutAction}
                  className="mt-5"
                >
                  <input type="hidden" name="orgSlug" value={slug} />
                  <input type="hidden" name="plan" value={id} />
                  <SubmitButton
                    className="w-full"
                    variant={
                      comparePlans(id, plan.id) > 0 ? "primary" : "secondary"
                    }
                  >
                    {!sub
                      ? `Assinar ${p.name}`
                      : comparePlans(id, plan.id) > 0
                        ? `Fazer upgrade para ${p.name}`
                        : `Mudar para ${p.name}`}
                  </SubmitButton>
                </ActionForm>
              )}
            </Card>
          );
        })}
      </div>

      {isOwner && sub && (
        <Card className="mt-6">
          <h2 className="mb-1 font-semibold">Cancelamento</h2>
          <p className="mb-4 text-sm text-slate-600">
            Ao cancelar, você continua com o {plan.name} até o fim do período já
            pago e depois volta ao Grátis.
          </p>
          <div className="flex flex-wrap gap-3">
            <ActionForm action={cancelAction}>
              <input type="hidden" name="orgSlug" value={slug} />
              <input
                type="hidden"
                name="cancel"
                value={sub.cancelAtPeriodEnd ? "0" : "1"}
              />
              <SubmitButton
                variant={sub.cancelAtPeriodEnd ? "secondary" : "danger"}
              >
                {sub.cancelAtPeriodEnd
                  ? "Desfazer cancelamento"
                  : "Cancelar assinatura"}
              </SubmitButton>
            </ActionForm>
            {fake && sub.cancelAtPeriodEnd && (
              <ActionForm action={endPeriodAction}>
                <input type="hidden" name="orgSlug" value={slug} />
                <SubmitButton variant="ghost">
                  Simular fim do período
                </SubmitButton>
              </ActionForm>
            )}
          </div>
        </Card>
      )}

      {fake && (
        <p className="mt-6 text-xs text-slate-500">
          Ambiente de demonstração: os pagamentos são simulados, mas cada
          mudança passa por um webhook no formato do Stripe, assinado e
          verificado.
        </p>
      )}
    </>
  );
}
