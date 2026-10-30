import { Badge } from "@/components/ui";
import { getPlan } from "@/lib/plans";
import { can, ROLE_LABELS } from "@/lib/rbac";
import { requireOrgPage } from "@/lib/session";
import { OrgNav } from "./org-nav";

export default async function OrgLayout({
  children,
  params,
}: LayoutProps<"/app/[org]">) {
  const { org: slug } = await params;
  const { org, role } = await requireOrgPage(slug);
  const links = [
    { href: `/app/${slug}`, label: "Orçamentos" },
    { href: `/app/${slug}/equipe`, label: "Equipe" },
    { href: `/app/${slug}/plano`, label: "Plano" },
    ...(can(role, "audit:read")
      ? [{ href: `/app/${slug}/auditoria`, label: "Auditoria" }]
      : []),
  ];
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:flex-row">
      <aside className="md:w-56 md:shrink-0">
        <div className="mb-4">
          <p className="truncate font-bold text-slate-900">{org.name}</p>
          <div className="mt-1 flex gap-2">
            <Badge tone="blue">{getPlan(org.plan).name}</Badge>
            <Badge>{ROLE_LABELS[role]}</Badge>
          </div>
        </div>
        <OrgNav links={links} />
      </aside>
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
