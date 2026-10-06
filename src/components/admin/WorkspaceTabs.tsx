"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function WorkspaceTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/admin/vsls/${id}`;

  const tabs = [
    { href: base, label: "Conteúdo" },
    { href: `${base}/blocks`, label: "Blocos" },
    { href: `${base}/leads`, label: "Leads" },
    { href: `${base}/settings`, label: "Configurações" },
  ];

  function isActive(href: string) {
    if (href === base) return pathname === base;
    return pathname.startsWith(href);
  }

  return (
    <nav className="flex gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          className={
            "border-b-2 px-4 py-2.5 text-sm font-medium transition " +
            (isActive(t.href)
              ? "border-sky-600 text-sky-700"
              : "border-transparent text-slate-500 hover:text-slate-800")
          }
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
