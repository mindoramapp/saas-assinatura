import Link from "next/link";
import { getCurrentUser, isPlatformAdmin } from "@/lib/session";
import { SignOutButton } from "./sign-out-button";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      {isPlatformAdmin(user.email) && (
        <Link
          href="/admin"
          className="text-brand-600 font-semibold hover:underline"
        >
          Métricas
        </Link>
      )}
      <span className="hidden text-slate-600 sm:inline">{user.name}</span>
      <SignOutButton />
    </div>
  );
}
