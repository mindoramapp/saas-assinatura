import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import type { Role } from "@/lib/rbac";

export async function makeUser(name = "Pessoa") {
  const id = randomUUID();
  return db.user.create({
    data: {
      id,
      name,
      email: `${name.toLowerCase().replace(/\W/g, "")}-${id.slice(0, 8)}@teste.dev`,
    },
  });
}

export async function makeOrg(plan: "FREE" | "PRO" | "BUSINESS" = "FREE") {
  const id = randomUUID().slice(0, 8);
  return db.organization.create({
    data: { name: `Org ${id}`, slug: `org-${id}`, plan },
  });
}

export async function addMember(orgId: string, role: Role, name = role) {
  const user = await makeUser(name);
  const membership = await db.membership.create({
    data: { orgId, userId: user.id, role },
  });
  return { user, membership };
}
