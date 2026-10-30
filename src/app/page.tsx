import Link from "next/link";
import { LinkButton, Logo } from "@/components/ui";
import { formatBRL, PLAN_IDS, PLANS } from "@/lib/plans";

const benefits = [
  {
    title: "Pronto em 2 minutos",
    text: "Itens, quantidades e total calculado. Sem planilha, sem erro de conta.",
  },
  {
    title: "Cliente aprova pelo link",
    text: "Mande pelo WhatsApp. O cliente abre no celular e aprova com um toque.",
  },
  {
    title: "Equipe organizada",
    text: "Cada pessoa com o seu acesso: quem vende, quem acompanha, quem só consulta.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5">
        <Logo className="text-xl" />
        <nav className="flex items-center gap-2 text-sm">
          <Link
            href="/entrar"
            className="rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-white"
          >
            Entrar
          </Link>
          <LinkButton href="/cadastro">Começar grátis</LinkButton>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-4xl px-4 pt-12 pb-16 text-center sm:pt-20">
          <p className="bg-brand-100 text-brand-700 mb-4 inline-block rounded-full px-3 py-1 text-xs font-semibold">
            Orçamentos para pequenos negócios
          </p>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
            Orçamentos bonitos que{" "}
            <span className="text-brand-600">fecham negócio</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
            Monte o orçamento, mande o link e acompanhe quando o cliente
            aprovar. Tudo em um lugar, do celular ou do computador.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <LinkButton href="/cadastro" className="px-6 py-3 text-base">
              Criar meu primeiro orçamento
            </LinkButton>
            <LinkButton
              href="#planos"
              variant="secondary"
              className="px-6 py-3 text-base"
            >
              Ver planos
            </LinkButton>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-3">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="font-bold text-slate-900">{b.title}</h2>
              <p className="mt-2 text-sm text-slate-600">{b.text}</p>
            </div>
          ))}
        </section>

        <section
          id="planos"
          className="mx-auto max-w-5xl scroll-mt-8 px-4 pb-20"
        >
          <h2 className="mb-8 text-center text-3xl font-bold tracking-tight">
            Planos simples
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {PLAN_IDS.map((id) => {
              const plan = PLANS[id];
              const featured = id === "PRO";
              return (
                <div
                  key={id}
                  className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                    featured
                      ? "border-brand-500 ring-brand-500 ring-2"
                      : "border-slate-200"
                  }`}
                >
                  <h3 className="font-bold">{plan.name}</h3>
                  <p className="mt-2 text-3xl font-extrabold">
                    {plan.priceCents ? formatBRL(plan.priceCents) : "R$ 0"}
                    <span className="text-sm font-medium text-slate-500">
                      /mês
                    </span>
                  </p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-slate-700">
                    {plan.highlights.map((h) => (
                      <li key={h}>✓ {h}</li>
                    ))}
                  </ul>
                  <LinkButton
                    href="/cadastro"
                    variant={featured ? "primary" : "secondary"}
                    className="mt-6"
                  >
                    {plan.priceCents
                      ? `Assinar ${plan.name}`
                      : "Começar grátis"}
                  </LinkButton>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        Orçaí · projeto de portfólio · pagamentos simulados (nenhuma cobrança
        real)
      </footer>
    </div>
  );
}
