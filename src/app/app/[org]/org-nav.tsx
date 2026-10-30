"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function OrgNav({
  links,
}: {
  links: { href: string; label: string }[];
}) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Seções da empresa"
      className="flex gap-1 overflow-x-auto md:flex-col"
    >
      {links.map((link, index) => {
        // O primeiro link (Orçamentos) também fica ativo nas subpáginas de orçamento.
        const active =
          index === 0
            ? pathname === link.href ||
              pathname.startsWith(`${link.href}/orcamentos`)
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap ${
              active
                ? "bg-brand-50 text-brand-700"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
