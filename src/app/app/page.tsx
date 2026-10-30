import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, Field } from "@/components/ui";
import { listUserOrganizations } from "@/lib/orgs";
import { getPlan } from "@/lib/plans";
import { isRole, ROLE_LABELS } from "@/lib/rbac";
import { requireUser } from "@/lib/session";
import { createOrgAction } from "./actions";

export default async function AppHome({ searchParams }: PageProps<"/app">) {
  const user = await requireUser("/app");
  const memberships = await listUserOrganizations(user.id);
  const { nova } = await searchParams;
  // Com uma única organização, vai direto para ela.
  if (memberships.length === 1 && !nova)
    redirect(`/app/${memberships[0]!.org.slug}`);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      {memberships.length > 0 && (
        <Card className="mb-6">
          <h1 className="mb-4 text-xl font-bold">Suas empresas</h1>
          <ul className="divide-y divide-slate-100">
            {memberships.map(({ org, role }) => (
              <li key={org.id}>
                <Link
                  href={`/app/${org.slug}`}
                  className="hover:text-brand-600 flex items-center justify-between py-3"
                >
                  <span className="font-medium">{org.name}</span>
                  <span className="flex gap-2">
                    <Badge tone="blue">{getPlan(org.plan).name}</Badge>
                    <Badge>{isRole(role) ? ROLE_LABELS[role] : role}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card>
        <h2 className="mb-1 text-xl font-bold">
          {memberships.length
            ? "Criar outra empresa"
            : `Bem-vindo(a), ${user.name.split(" ")[0]}!`}
        </h2>
        <p className="mb-4 text-sm text-slate-600">
          Como se chama o seu negócio? Ele aparece no topo de cada orçamento.
        </p>
        <ActionForm action={createOrgAction} className="space-y-4">
          <Field
            label="Nome da empresa"
            name="name"
            required
            minLength={2}
            placeholder="Ex.: Marcenaria Bom Lar"
          />
          <SubmitButton>Criar empresa</SubmitButton>
        </ActionForm>
      </Card>
    </main>
  );
}
