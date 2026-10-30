import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Caixa de saída (dev)" };

export default function DevEmailsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <h1 className="mb-1 text-2xl font-bold">
        Caixa de saída (desenvolvimento)
      </h1>
      <p className="mb-6 text-sm text-slate-600">
        Sem <code>RESEND_API_KEY</code>, os e-mails do Orçaí ficam aqui em vez
        de serem enviados.
      </p>
      <Suspense
        fallback={<p className="text-sm text-slate-500">Carregando…</p>}
      >
        <Emails />
      </Suspense>
    </main>
  );
}

async function Emails() {
  await connection();
  // Com envio real configurado, esta página não existe.
  if (process.env.RESEND_API_KEY) notFound();
  const emails = await db.outboxEmail.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  if (!emails.length)
    return <p className="text-sm text-slate-500">Nenhum e-mail ainda.</p>;
  return (
    <ul className="space-y-4">
      {emails.map((email) => (
        <li
          key={email.id}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <p className="text-xs text-slate-500">
            Para {email.to} · {email.createdAt.toLocaleString("pt-BR")}
          </p>
          <p className="mb-3 font-semibold">{email.subject}</p>
          {/* HTML gerado pelo próprio app, com os dados do usuário já escapados. */}
          <div
            className="prose prose-sm [&_a]:text-brand-600 text-sm [&_a]:font-semibold [&_a]:underline"
            dangerouslySetInnerHTML={{ __html: email.html }}
          />
        </li>
      ))}
    </ul>
  );
}
