import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SeriesChart } from "@/components/series-chart";
import { Card, Logo } from "@/components/ui";
import { loadMetrics } from "@/lib/metrics";
import { formatBRL, PLAN_IDS, PLANS } from "@/lib/plans";
import { isPlatformAdmin, requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Métricas" };

const pct = (n: number) =>
  `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function Kpi({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

export default function AdminPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Logo className="text-lg" />
          <Link
            href="/app"
            className="text-sm font-medium text-slate-600 hover:underline"
          >
            Voltar ao app
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <Suspense
          fallback={
            <p className="text-sm text-slate-500">Calculando métricas…</p>
          }
        >
          <Dashboard />
        </Suspense>
      </main>
    </div>
  );
}

async function Dashboard() {
  const user = await requireUser("/admin");
  // Painel da plataforma: só para os e-mails de PLATFORM_ADMIN_EMAILS.
  if (!isPlatformAdmin(user.email)) notFound();
  const m = await loadMetrics();
  const totalOrgs = Object.values(m.plans).reduce((a, b) => a + b, 0);

  return (
    <>
      <h1 className="mb-1 text-2xl font-bold tracking-tight">
        Métricas do negócio
      </h1>
      <p className="mb-6 text-sm text-slate-600">
        Receita recorrente, retenção e uso do Orçaí.
      </p>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="MRR"
          value={formatBRL(m.mrr)}
          hint={
            m.mrrGrowth === null
              ? `${m.paying} assinaturas ativas`
              : `${m.mrrGrowth >= 0 ? "▲" : "▼"} ${pct(Math.abs(m.mrrGrowth))} vs. mês anterior`
          }
        />
        <Kpi
          label="Churn (30 dias)"
          value={pct(m.churn.customerRate)}
          hint={`${m.churn.canceled} de ${m.churn.activeAtStart} clientes · receita ${pct(m.churn.revenueRate)}`}
        />
        <Kpi
          label="Usuários ativos"
          value={`${m.mau}`}
          hint={`no mês · ${m.dau} hoje`}
        />
        <Kpi
          label="Ativação"
          value={pct(m.activation.rate)}
          hint={`${m.activation.activated} de ${m.activation.eligible} empresas: 1º orçamento em até 7 dias`}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card>
          <h2 className="font-semibold">MRR nos últimos 12 meses</h2>
          <p className="mb-3 text-xs text-slate-500">
            Ticket médio: {formatBRL(m.arpa)} por cliente pagante
          </p>
          <SeriesChart
            title="MRR nos últimos 12 meses"
            data={m.mrrSeries}
            kind="area"
            format="brl"
          />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Empresas por plano</h2>
          <ul className="space-y-4">
            {PLAN_IDS.map((id) => {
              const count = m.plans[id] ?? 0;
              const share = totalOrgs ? count / totalOrgs : 0;
              return (
                <li key={id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className="font-medium text-slate-700">
                      {PLANS[id].name}
                    </span>
                    <span className="text-slate-600">
                      {count} · {pct(share)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="bg-brand-600 h-2 rounded-full"
                      style={{ width: `${share * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            {totalOrgs} empresas no total
          </p>
        </Card>
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 font-semibold">
          Usuários ativos por dia (30 dias)
        </h2>
        <SeriesChart
          title="Usuários ativos por dia"
          data={m.dailyActive}
          kind="bar"
          format="int"
        />
      </Card>
    </>
  );
}
