import { randomBytes } from "node:crypto";
import { track } from "@/lib/analytics";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { escapeHtml, sendEmail } from "@/lib/email";
import { DomainError } from "@/lib/errors";
import { getOrgAccess } from "@/lib/orgs";
import { canAddSeat, getPlan } from "@/lib/plans";
import { canAssignRole, isRole, ROLE_LABELS, type Role } from "@/lib/rbac";

const INVITE_DAYS = 7;

export async function countSeats(orgId: string) {
  const [members, pending] = await Promise.all([
    db.membership.count({ where: { orgId } }),
    db.invitation.count({
      where: {
        orgId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    }),
  ]);
  return members + pending;
}

export async function inviteMember(input: {
  actorId: string;
  orgSlug: string;
  email: string;
  role: string;
  appUrl: string;
}) {
  const { org, role: actorRole } = await getOrgAccess(
    input.actorId,
    input.orgSlug,
    "member:invite",
  );
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new DomainError("invalid", "Informe um e-mail válido.");
  }
  if (!isRole(input.role) || !canAssignRole(actorRole, null, input.role)) {
    throw new DomainError(
      "forbidden",
      "Você não pode convidar alguém com esse papel.",
    );
  }
  const alreadyMember = await db.membership.findFirst({
    where: { orgId: org.id, user: { email } },
  });
  if (alreadyMember)
    throw new DomainError("conflict", "Essa pessoa já faz parte da equipe.");

  const seats = canAddSeat(getPlan(org.plan), await countSeats(org.id));
  if (!seats.ok) throw new DomainError("limit", seats.reason);

  // Um convite pendente por e-mail: reenviar substitui o anterior.
  await db.invitation.updateMany({
    where: { orgId: org.id, email, acceptedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  const invitation = await db.invitation.create({
    data: {
      orgId: org.id,
      email,
      role: input.role,
      token: randomBytes(24).toString("base64url"),
      invitedById: input.actorId,
      expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
    },
  });

  const link = `${input.appUrl}/convite/${invitation.token}`;
  await sendEmail({
    to: email,
    subject: `Convite para a equipe ${org.name} no Orçaí`,
    html: `<p>Você foi convidado(a) para entrar na equipe <strong>${escapeHtml(org.name)}</strong> como <strong>${ROLE_LABELS[input.role]}</strong>.</p><p><a href="${link}">Aceitar convite</a> (vale por ${INVITE_DAYS} dias)</p>`,
  });
  await audit({
    orgId: org.id,
    actorId: input.actorId,
    action: "member.invited",
    target: email,
    metadata: { role: input.role },
  });
  return invitation;
}

export async function revokeInvitation(
  actorId: string,
  orgSlug: string,
  invitationId: string,
) {
  const { org } = await getOrgAccess(actorId, orgSlug, "member:invite");
  const invitation = await db.invitation.findFirst({
    where: {
      id: invitationId,
      orgId: org.id,
      acceptedAt: null,
      revokedAt: null,
    },
  });
  if (!invitation)
    throw new DomainError("not_found", "Convite não encontrado.");
  await db.invitation.update({
    where: { id: invitation.id },
    data: { revokedAt: new Date() },
  });
  await audit({
    orgId: org.id,
    actorId,
    action: "member.invite_revoked",
    target: invitation.email,
  });
}

export async function getInvitation(token: string) {
  const invitation = await db.invitation.findUnique({
    where: { token },
    include: { org: true },
  });
  if (!invitation || invitation.revokedAt)
    return { status: "invalid" as const };
  if (invitation.acceptedAt) return { status: "accepted" as const, invitation };
  if (invitation.expiresAt < new Date())
    return { status: "expired" as const, invitation };
  return { status: "pending" as const, invitation };
}

export async function acceptInvitation(input: {
  token: string;
  userId: string;
  userEmail: string;
}) {
  const found = await getInvitation(input.token);
  if (found.status !== "pending") {
    throw new DomainError("invalid", "Este convite não é mais válido.");
  }
  const { invitation } = found;
  if (invitation.email !== input.userEmail.toLowerCase()) {
    throw new DomainError(
      "forbidden",
      `Este convite foi enviado para ${invitation.email}. Entre com esse e-mail para aceitar.`,
    );
  }
  await db.$transaction([
    db.membership.upsert({
      where: {
        orgId_userId: { orgId: invitation.orgId, userId: input.userId },
      },
      create: {
        orgId: invitation.orgId,
        userId: input.userId,
        role: invitation.role,
      },
      update: {},
    }),
    db.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ]);
  await audit({
    orgId: invitation.orgId,
    actorId: input.userId,
    action: "member.joined",
    target: invitation.email,
    metadata: { role: invitation.role },
  });
  await track("member.joined", {
    userId: input.userId,
    orgId: invitation.orgId,
  });
  return invitation.org;
}

async function countOwners(orgId: string) {
  return db.membership.count({ where: { orgId, role: "owner" } });
}

export async function changeMemberRole(input: {
  actorId: string;
  orgSlug: string;
  membershipId: string;
  role: string;
}) {
  const { org, role: actorRole } = await getOrgAccess(
    input.actorId,
    input.orgSlug,
    "member:manage",
  );
  const target = await db.membership.findFirst({
    where: { id: input.membershipId, orgId: org.id },
    include: { user: true },
  });
  if (!target || !isRole(target.role))
    throw new DomainError("not_found", "Pessoa não encontrada.");
  if (
    !isRole(input.role) ||
    !canAssignRole(actorRole, target.role, input.role)
  ) {
    throw new DomainError(
      "forbidden",
      "Você não pode dar esse papel a essa pessoa.",
    );
  }
  if (
    target.role === "owner" &&
    input.role !== "owner" &&
    (await countOwners(org.id)) === 1
  ) {
    throw new DomainError(
      "conflict",
      "A organização precisa de pelo menos um dono.",
    );
  }
  await db.membership.update({
    where: { id: target.id },
    data: { role: input.role },
  });
  await audit({
    orgId: org.id,
    actorId: input.actorId,
    action: "member.role_changed",
    target: target.user.email,
    metadata: { from: target.role, to: input.role },
  });
}

export async function removeMember(input: {
  actorId: string;
  orgSlug: string;
  membershipId: string;
}) {
  const { org, role: actorRole } = await getOrgAccess(
    input.actorId,
    input.orgSlug,
    "member:manage",
  );
  const target = await db.membership.findFirst({
    where: { id: input.membershipId, orgId: org.id },
    include: { user: true },
  });
  if (!target) throw new DomainError("not_found", "Pessoa não encontrada.");
  if (target.role === "owner" && actorRole !== "owner") {
    throw new DomainError("forbidden", "Só um dono pode remover outro dono.");
  }
  if (target.role === "owner" && (await countOwners(org.id)) === 1) {
    throw new DomainError(
      "conflict",
      "A organização precisa de pelo menos um dono.",
    );
  }
  await db.membership.delete({ where: { id: target.id } });
  await audit({
    orgId: org.id,
    actorId: input.actorId,
    action: "member.removed",
    target: target.user.email,
    metadata: { role: target.role as Role },
  });
}
