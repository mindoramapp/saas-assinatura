import "server-only";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DomainError } from "@/lib/errors";
import { getOrgAccess } from "@/lib/orgs";
import type { Permission } from "@/lib/rbac";

export async function getCurrentUser() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function requireUser(next?: string) {
  const user = await getCurrentUser();
  if (!user)
    redirect(next ? `/entrar?next=${encodeURIComponent(next)}` : "/entrar");
  return user;
}

/** Para páginas: membro sem acesso vê 404; com acesso, recebe org e papel. */
export async function requireOrgPage(slug: string, permission?: Permission) {
  const user = await requireUser(`/app/${slug}`);
  try {
    return { user, ...(await getOrgAccess(user.id, slug, permission)) };
  } catch (error) {
    if (error instanceof DomainError && error.code === "not_found") notFound();
    throw error;
  }
}

export function isPlatformAdmin(email: string): boolean {
  const list = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export function appUrl(): string {
  return (
    process.env.APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000"
  );
}
