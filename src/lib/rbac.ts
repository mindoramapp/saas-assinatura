export const ROLES = ["owner", "admin", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Dono",
  admin: "Admin",
  member: "Membro",
  viewer: "Leitor",
};

/** Nível de cada papel: quem tem nível maior herda as permissões de quem tem menor. */
const RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

export const PERMISSIONS = {
  "quote:read": "viewer",
  "quote:write": "member",
  "member:invite": "admin",
  "member:manage": "admin",
  "audit:read": "admin",
  "org:settings": "admin",
  "billing:manage": "owner",
} as const satisfies Record<string, Role>;

export type Permission = keyof typeof PERMISSIONS;

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function can(role: string, permission: Permission): boolean {
  if (!isRole(role)) return false;
  return RANK[role] >= RANK[PERMISSIONS[permission]];
}

/**
 * Quem pode dar (ou tirar) um papel a outra pessoa:
 * só o dono mexe em donos, e ninguém concede um papel acima do próprio.
 */
export function canAssignRole(
  actor: string,
  currentTarget: Role | null,
  next: Role,
): boolean {
  if (!isRole(actor) || !can(actor, "member:manage")) return false;
  if (actor === "owner") return true;
  if (currentTarget === "owner" || next === "owner") return false;
  return RANK[next] <= RANK[actor];
}
