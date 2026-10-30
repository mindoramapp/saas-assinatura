import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, Field, PageHeader, Select } from "@/components/ui";
import { db } from "@/lib/db";
import { getPlan } from "@/lib/plans";
import { can, canAssignRole, isRole, ROLE_LABELS, ROLES } from "@/lib/rbac";
import { requireOrgPage } from "@/lib/session";
import { countSeats } from "@/lib/team";
import {
  changeRoleAction,
  inviteAction,
  removeMemberAction,
  revokeInviteAction,
} from "./actions";

export const metadata: Metadata = { title: "Equipe" };

export default async function TeamPage({
  params,
}: PageProps<"/app/[org]/equipe">) {
  const { org: slug } = await params;
  const { user, org, role } = await requireOrgPage(slug);
  const plan = getPlan(org.plan);
  const [members, invitations, seats] = await Promise.all([
    db.membership.findMany({
      where: { orgId: org.id },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    db.invitation.findMany({
      where: {
        orgId: org.id,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    }),
    countSeats(org.id),
  ]);
  const canInvite = can(role, "member:invite");
  const canManage = can(role, "member:manage");
  const invitable = ROLES.filter((r) => canAssignRole(role, null, r));
  const seatsLabel = Number.isFinite(plan.seats)
    ? `${seats} de ${plan.seats}`
    : `${seats}`;

  return (
    <>
      <PageHeader
        title="Equipe"
        description={`Lugares usados: ${seatsLabel} (membros e convites pendentes).`}
      />

      {canInvite && (
        <Card className="mb-6">
          <h2 className="mb-4 font-semibold">Convidar pessoa</h2>
          <ActionForm
            action={inviteAction}
            className="grid gap-4 sm:grid-cols-[1fr_10rem_auto] sm:items-end"
          >
            <input type="hidden" name="orgSlug" value={slug} />
            <Field
              label="E-mail"
              name="email"
              type="email"
              required
              placeholder="pessoa@empresa.com"
            />
            <Select label="Papel" name="role" defaultValue="member">
              {invitable.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
            <SubmitButton>Enviar convite</SubmitButton>
          </ActionForm>
          {seats >= plan.seats && (
            <p className="mt-3 text-sm text-amber-800">
              Sua equipe chegou ao limite do plano {plan.name}.{" "}
              <Link
                href={`/app/${slug}/plano`}
                className="font-semibold underline"
              >
                Ver planos
              </Link>
            </p>
          )}
        </Card>
      )}

      <Card className="mb-6">
        <h2 className="mb-2 font-semibold">Pessoas</h2>
        <ul className="divide-y divide-slate-100">
          {members.map((m) => {
            const memberRole = isRole(m.role) ? m.role : "viewer";
            const options = ROLES.filter((r) =>
              canAssignRole(role, memberRole, r),
            );
            const editable =
              canManage && m.userId !== user.id && options.length > 0;
            return (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium">
                    {m.user.name}{" "}
                    {m.userId === user.id && (
                      <span className="text-slate-500">(você)</span>
                    )}
                  </p>
                  <p className="text-sm text-slate-500">{m.user.email}</p>
                </div>
                {editable ? (
                  <div className="flex items-center gap-2">
                    <ActionForm
                      action={changeRoleAction}
                      className="flex items-center gap-2"
                    >
                      <input type="hidden" name="orgSlug" value={slug} />
                      <input type="hidden" name="membershipId" value={m.id} />
                      <label className="sr-only" htmlFor={`role-${m.id}`}>
                        Papel de {m.user.name}
                      </label>
                      <select
                        id={`role-${m.id}`}
                        name="role"
                        defaultValue={memberRole}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
                      >
                        {options.map((r) => (
                          <option key={r} value={r}>
                            {ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      <SubmitButton variant="secondary" className="px-3 py-1.5">
                        Salvar
                      </SubmitButton>
                    </ActionForm>
                    <ActionForm action={removeMemberAction}>
                      <input type="hidden" name="orgSlug" value={slug} />
                      <input type="hidden" name="membershipId" value={m.id} />
                      <SubmitButton variant="danger" className="px-3 py-1.5">
                        Remover
                      </SubmitButton>
                    </ActionForm>
                  </div>
                ) : (
                  <Badge>{ROLE_LABELS[memberRole]}</Badge>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">Convites pendentes</h2>
          <ul className="divide-y divide-slate-100">
            {invitations.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium">{inv.email}</p>
                  <p className="text-sm text-slate-500">
                    {isRole(inv.role) ? ROLE_LABELS[inv.role] : inv.role} ·
                    expira em {inv.expiresAt.toLocaleDateString("pt-BR")}
                  </p>
                </div>
                {canInvite && (
                  <ActionForm action={revokeInviteAction}>
                    <input type="hidden" name="orgSlug" value={slug} />
                    <input type="hidden" name="invitationId" value={inv.id} />
                    <SubmitButton variant="ghost" className="px-3 py-1.5">
                      Cancelar convite
                    </SubmitButton>
                  </ActionForm>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
