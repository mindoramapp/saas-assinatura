import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { createOrganization, getOrgAccess } from "@/lib/orgs";
import {
  acceptInvitation,
  changeMemberRole,
  inviteMember,
  removeMember,
  revokeInvitation,
} from "@/lib/team";
import { addMember, makeOrg, makeUser } from "@/test/factories";

const appUrl = "http://localhost:3000";

describe("organizações", () => {
  it("quem cria vira dono, com slug sem acentos e registro na auditoria", async () => {
    const user = await makeUser("Ana");
    const org = await createOrganization(user.id, "Padaria São João");
    expect(org.slug).toMatch(/^padaria-sao-joao/);
    const access = await getOrgAccess(user.id, org.slug);
    expect(access.role).toBe("owner");
    const log = await db.auditLog.findFirst({ where: { orgId: org.id } });
    expect(log?.action).toBe("org.created");
  });

  it("quem não é membro recebe 'não encontrada' (não vaza a existência)", async () => {
    const org = await makeOrg();
    const stranger = await makeUser("Estranho");
    await expect(getOrgAccess(stranger.id, org.slug)).rejects.toMatchObject({
      code: "not_found",
    });
  });
});

describe("convites", () => {
  it("admin convida, o e-mail cai na caixa de saída e a pessoa entra com o papel certo", async () => {
    const org = await makeOrg("PRO");
    const { user: admin } = await addMember(org.id, "admin");
    const guest = await makeUser("Convidada");

    const invitation = await inviteMember({
      actorId: admin.id,
      orgSlug: org.slug,
      email: guest.email.toUpperCase(),
      role: "member",
      appUrl,
    });
    const email = await db.outboxEmail.findFirst({
      where: { to: guest.email },
    });
    expect(email?.html).toContain(`/convite/${invitation.token}`);

    await acceptInvitation({
      token: invitation.token,
      userId: guest.id,
      userEmail: guest.email,
    });
    expect((await getOrgAccess(guest.id, org.slug)).role).toBe("member");
    // Convite usado não vale de novo.
    await expect(
      acceptInvitation({
        token: invitation.token,
        userId: guest.id,
        userEmail: guest.email,
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });

  it("RBAC no servidor: membro e leitor não convidam; admin não convida dono", async () => {
    const org = await makeOrg("BUSINESS");
    const { user: member } = await addMember(org.id, "member");
    const { user: viewer } = await addMember(org.id, "viewer");
    const { user: admin } = await addMember(org.id, "admin");
    const base = { orgSlug: org.slug, email: "x@teste.dev", appUrl };

    await expect(
      inviteMember({ ...base, actorId: member.id, role: "viewer" }),
    ).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(
      inviteMember({ ...base, actorId: viewer.id, role: "viewer" }),
    ).rejects.toMatchObject({
      code: "forbidden",
    });
    await expect(
      inviteMember({ ...base, actorId: admin.id, role: "owner" }),
    ).rejects.toMatchObject({
      code: "forbidden",
    });
  });

  it("plano Grátis (1 pessoa) bloqueia convites; convites pendentes contam no Pro", async () => {
    const free = await makeOrg("FREE");
    const { user: owner } = await addMember(free.id, "owner");
    await expect(
      inviteMember({
        actorId: owner.id,
        orgSlug: free.slug,
        email: "a@teste.dev",
        role: "member",
        appUrl,
      }),
    ).rejects.toMatchObject({ code: "limit" });

    const pro = await makeOrg("PRO");
    const { user: proOwner } = await addMember(pro.id, "owner");
    for (const n of [1, 2, 3, 4]) {
      await inviteMember({
        actorId: proOwner.id,
        orgSlug: pro.slug,
        email: `p${n}@teste.dev`,
        role: "member",
        appUrl,
      });
    }
    await expect(
      inviteMember({
        actorId: proOwner.id,
        orgSlug: pro.slug,
        email: "p5@teste.dev",
        role: "member",
        appUrl,
      }),
    ).rejects.toMatchObject({ code: "limit" });
  });

  it("convite só pode ser aceito pelo e-mail convidado, e revogado deixa de valer", async () => {
    const org = await makeOrg("PRO");
    const { user: owner } = await addMember(org.id, "owner");
    const intruder = await makeUser("Intruso");
    const invitation = await inviteMember({
      actorId: owner.id,
      orgSlug: org.slug,
      email: "certo@teste.dev",
      role: "viewer",
      appUrl,
    });
    await expect(
      acceptInvitation({
        token: invitation.token,
        userId: intruder.id,
        userEmail: intruder.email,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });

    await revokeInvitation(owner.id, org.slug, invitation.id);
    await expect(
      acceptInvitation({
        token: invitation.token,
        userId: intruder.id,
        userEmail: "certo@teste.dev",
      }),
    ).rejects.toMatchObject({ code: "invalid" });
  });
});

describe("papéis e remoção", () => {
  it("não deixa a organização sem dono", async () => {
    const org = await makeOrg();
    const { user: owner, membership } = await addMember(org.id, "owner");
    await expect(
      changeMemberRole({
        actorId: owner.id,
        orgSlug: org.slug,
        membershipId: membership.id,
        role: "admin",
      }),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      removeMember({
        actorId: owner.id,
        orgSlug: org.slug,
        membershipId: membership.id,
      }),
    ).rejects.toMatchObject({ code: "conflict" });
  });

  it("admin rebaixa membro a leitor e registra na auditoria; não remove o dono", async () => {
    const org = await makeOrg("BUSINESS");
    const { membership: ownerMembership } = await addMember(org.id, "owner");
    const { user: admin } = await addMember(org.id, "admin");
    const { membership: memberMembership } = await addMember(org.id, "member");

    await changeMemberRole({
      actorId: admin.id,
      orgSlug: org.slug,
      membershipId: memberMembership.id,
      role: "viewer",
    });
    const log = await db.auditLog.findFirst({
      where: { orgId: org.id, action: "member.role_changed" },
    });
    expect(JSON.parse(log!.metadata)).toEqual({ from: "member", to: "viewer" });

    await expect(
      removeMember({
        actorId: admin.id,
        orgSlug: org.slug,
        membershipId: ownerMembership.id,
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});
