import { PageHeader } from "@/components/ui";
import { requireOrgPage } from "@/lib/session";

export default async function QuotesPage({ params }: PageProps<"/app/[org]">) {
  const { org } = await requireOrgPage((await params).org);
  return (
    <PageHeader title="Orçamentos" description={`Orçamentos de ${org.name}.`} />
  );
}
