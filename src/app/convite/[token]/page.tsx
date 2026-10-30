import type { Metadata } from "next";
import { Suspense } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, LinkButton, Logo } from "@/components/ui";
import { isRole, ROLE_LABELS } from "@/lib/rbac";
import { getCurrentUser } from "@/lib/session";
import { getInvitation } from "@/lib/team";
import { acceptInviteAction } from "./actions";

export const metadata: Metadata = { title: "Convite" };

export default function InvitePage({ params }: PageProps<"/convite/[token]">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <Logo className="mb-8 text-2xl" />
      <Card className="w-full max-w-md text-center">
        <Suspense
          fallback={
            <p className="text-sm text-slate-500">Carregando convite…</p>
          }
        >
          <Invite params={params} />
        </Suspense>
      </Card>
    </main>
  );
}

async function Invite({
  params,
}: Pick<PageProps<"/convite/[token]">, "params">) {
  const { token } = await params;
  const found = await getInvitation(token);
  if (found.status !== "pending") {
    return (
      <>
        <h1 className="mb-2 text-xl font-bold">Convite indisponível</h1>
        <p className="text-sm text-slate-600">
          {found.status === "accepted"
            ? "Este convite já foi usado."
            : found.status === "expired"
              ? "Este convite expirou. Peça um novo para quem convidou você."
              : "Este link de convite não é válido."}
        </p>
      </>
    );
  }
  const { invitation } = found;
  const user = await getCurrentUser();
  const next = encodeURIComponent(`/convite/${token}`);
  return (
    <>
      <h1 className="mb-2 text-xl font-bold">
        Convite para {invitation.org.name}
      </h1>
      <p className="mb-6 text-sm text-slate-600">
        Você foi convidado(a) como{" "}
        <strong>
          {isRole(invitation.role)
            ? ROLE_LABELS[invitation.role]
            : invitation.role}
        </strong>{" "}
        para o e-mail <strong>{invitation.email}</strong>.
      </p>
      {user ? (
        <ActionForm action={acceptInviteAction}>
          <input type="hidden" name="token" value={token} />
          <SubmitButton className="w-full">
            Aceitar e entrar na equipe
          </SubmitButton>
        </ActionForm>
      ) : (
        <div className="flex flex-col gap-2">
          <LinkButton href={`/cadastro?next=${next}`}>
            Criar conta e aceitar
          </LinkButton>
          <LinkButton href={`/entrar?next=${next}`} variant="secondary">
            Já tenho conta
          </LinkButton>
        </div>
      )}
    </>
  );
}
