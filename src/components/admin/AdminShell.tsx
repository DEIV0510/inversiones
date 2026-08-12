"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  IconHome,
  IconLogOut,
  IconPlus,
  IconSliders,
  IconTicket,
  IconTrophy,
} from "@/components/icons";

const NAV = [
  { href: "/admin", label: "Inicio", icon: IconHome, exact: true },
  { href: "/admin/rifas", label: "Rifas", icon: IconTicket, exact: false },
  { href: "/admin/ganadores", label: "Ganadores", icon: IconTrophy, exact: false },
  { href: "/admin/config", label: "Ajustes", icon: IconSliders, exact: false },
];

const SIDEBAR_GROUPS = [
  {
    title: "Análisis",
    items: [{ href: "/admin", label: "Dashboard", icon: IconHome, exact: true }],
  },
  {
    title: "Rifas",
    items: [
      { href: "/admin/rifas", label: "Sorteos", icon: IconTicket, exact: true },
      { href: "/admin/rifas/nueva", label: "Nueva rifa", icon: IconPlus, exact: true },
    ],
  },
  {
    title: "Contenido",
    items: [
      { href: "/admin/ganadores", label: "Ganadores", icon: IconTrophy, exact: false },
    ],
  },
  {
    title: "Configuración",
    items: [
      { href: "/admin/config", label: "General", icon: IconSliders, exact: false },
    ],
  },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  async function logout() {
    setLoggingOut(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  }

  return (
    <div className="min-h-dvh bg-bg">
      {/* Barra superior */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-bg2/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-3 px-4 lg:px-6">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="glow-red-sm flex h-8 w-8 items-center justify-center rounded-lg bg-brand font-display text-xs font-black text-white">
              DS
            </span>
            <span className="font-display text-sm font-extrabold uppercase tracking-wide text-fg">
              Admin <span className="text-brand">Panel</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-xs font-bold uppercase tracking-wide text-fg-soft transition-colors hover:bg-well hover:text-fg"
            >
              Ver sitio
            </a>
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              aria-label="Cerrar sesión"
              className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-fg-soft transition-colors hover:bg-well hover:text-fg disabled:opacity-50"
            >
              <IconLogOut width={18} height={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar en escritorio */}
      <aside
        aria-label="Menú del panel"
        className="fixed bottom-0 left-0 top-14 z-30 hidden w-60 overflow-y-auto border-r border-line bg-bg2 px-3 py-6 lg:block"
      >
        <nav className="flex flex-col gap-6">
          {SIDEBAR_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-fg-faint">
                {group.title}
              </p>
              <div className="mt-2 flex flex-col gap-1">
                {group.items.map((item) => {
                  const active = isActive(item.href, item.exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
                        active
                          ? "glow-red-sm bg-brand text-white"
                          : "text-fg-soft hover:bg-well hover:text-fg"
                      }`}
                    >
                      <item.icon width={17} height={17} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="border-t border-line pt-4">
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-fg-soft transition-colors hover:bg-well hover:text-fg disabled:opacity-50"
            >
              <IconLogOut width={17} height={17} />
              Cerrar sesión
            </button>
          </div>
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-20 lg:ml-60 lg:max-w-2xl lg:px-8 lg:pb-16 lg:pt-24 xl:mx-auto">
        {children}
      </main>

      {/* Navegación inferior en móvil */}
      <nav
        aria-label="Navegación del panel"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg2/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-4">
          {NAV.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-bold ${
                  active ? "text-brand" : "text-fg-soft"
                }`}
              >
                <item.icon width={21} height={21} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
