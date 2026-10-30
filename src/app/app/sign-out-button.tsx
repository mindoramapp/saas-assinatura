"use client";

import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={buttonClass("ghost", "px-2 py-1")}
      onClick={async () => {
        await authClient.signOut();
        router.push("/");
        router.refresh();
      }}
    >
      Sair
    </button>
  );
}
