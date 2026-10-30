import { track } from "@/lib/analytics";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { DomainError } from "@/lib/errors";
import { can, isRole, type Permission, type Role } from "@/lib/rbac";

export function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "empresa"
  );
}

async function uniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  for (let n = 1; ; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!(await db.organization.findUnique({ where: { slug } }))) return slug;
  }
}

export async function createOrganization(userId: string, name: string) {
  const trimmed = name.trim();
  if (trimmed.length < 2)
    throw new DomainError("invalid", "Dê um nome com pelo menos 2 letras.");
  const org = await db.organization.create({
    data: {
      name: trimmed,
      slug: await uniqueSlug(trimmed),
      memberships: { create: { userId, role: "owner" } },
    },
  });
  await audit({
    orgId: org.id,
    actorId: userId,
    action: "org.created",
    target: org.name,
  });
  await track("org.created", { userId, orgId: org.id });
  return org;
}

export type OrgAccess = {
  org: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    brandColor: string | null;
  };
  role: Role;
};

/**
 * Checagem de acesso feita no servidor em toda página e action da organização:
 * quem não é membro recebe "não encontrado" (não revela que a org existe);
 * quem é membro sem a permissão recebe "sem permissão".
 */
export async function getOrgAccess(
  userId: string,
  slug: string,
  permission: Permission = "quote:read",
): Promise<OrgAccess> {
  const membership = await db.membership.findFirst({
    where: { userId, org: { slug } },
    include: { org: true },
  });
  if (!membership || !isRole(membership.role)) {
    throw new DomainError("not_found", "Organização não encontrada.");
  }
  if (!can(membership.role, permission)) {
    throw new DomainError(
      "forbidden",
      "Seu papel nesta organização não permite essa ação.",
    );
  }
  const { id, name, plan, brandColor } = membership.org;
  return { org: { id, name, slug, plan, brandColor }, role: membership.role };
}

export async function listUserOrganizations(userId: string) {
  return db.membership.findMany({
    where: { userId },
    include: { org: true },
    orderBy: { createdAt: "asc" },
  });
}
