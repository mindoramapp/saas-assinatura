import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/ui";
import { UserMenu } from "./user-menu";

export default function AppLayout({ children }: LayoutProps<"/app">) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/app" className="text-lg">
            <Logo />
          </Link>
          <Suspense>
            <UserMenu />
          </Suspense>
        </div>
      </header>
      <Suspense
        fallback={<p className="p-8 text-sm text-slate-500">Carregando…</p>}
      >
        {children}
      </Suspense>
    </div>
  );
}
