"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminRole } from "@prisma/client";
import { can, type Permission, ROLE_LABELS } from "@/lib/rbac";
import {
  IconCalendar,
  IconChevronDown,
  IconHome,
  IconLogOut,
  IconMenu,
  IconPlus,
  IconShieldCheck,
  IconSliders,
  IconTicket,
  IconTrophy,
  IconUsers,
  IconX,
} from "@/components/icons";

type NavItem = {
  href: string;
  label: string;
  icon: typeof IconHome;
  permission: Permission;
  exact?: boolean;
};

type NavGroup = { title: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    title: "Análisis",
    items: [
      { href: "/admin", label: "Dashboard", icon: IconHome, permission: "dashboard.view", exact: true },
      { href: "/admin/reportes", label: "Reportes", icon: IconCalendar, permission: "reports.view" },
    ],
  },
  {
    title: "Rifas",
    items: [
      { href: "/admin/rifas", label: "Sorteos", icon: IconTicket, permission: "numbers.view", exact: true },
      { href: "/admin/rifas/nueva", label: "Nueva rifa", icon: IconPlus, permission: "raffles.manage", exact: true },
      { href: "/admin/numeros", label: "Números", icon: IconSliders, permission: "numbers.view" },
    ],
  },
  {
    title: "Operación",
    items: [
      { href: "/admin/pedidos", label: "Pedidos", icon: IconTicket, permission: "orders.view" },
      { href: "/admin/reservas", label: "Reservas", icon: IconCalendar, permission: "reservations.view" },
      { href: "/admin/pagos", label: "Pagos", icon: IconShieldCheck, permission: "payments.view" },
      { href: "/admin/participantes", label: "Participantes", icon: IconUsers, permission: "participants.view" },
    ],
  },
  {
    title: "Contenido",
    items: [
      { href: "/admin/ganadores", label: "Ganadores", icon: IconTrophy, permission: "winners.manage" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { href: "/admin/config", label: "Configuración", icon: IconSliders, permission: "settings.manage" },
      { href: "/admin/usuarios", label: "Usuarios", icon: IconUsers, permission: "users.manage" },
      { href: "/admin/auditoria", label: "Auditoría", icon: IconShieldCheck, permission: "audit.view" },
    ],
  },
];

const MOBILE_MAIN: NavItem[] = [
  { href: "/admin", label: "Inicio", icon: IconHome, permission: "dashboard.view", exact: true },
  { href: "/admin/rifas", label: "Rifas", icon: IconTicket, permission: "numbers.view" },
  { href: "/admin/pedidos", label: "Pedidos", icon: IconCalendar, permission: "orders.view" },
];

export default function AdminShell({
  children,
  role,
  userName,
}: {
  children: React.ReactNode;
  role: AdminRole;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  const groups = GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => can(role, i.permission)),
  })).filter((g) => g.items.length > 0);

  const mobileMain = MOBILE_MAIN.filter((i) => can(role, i.permission));

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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/logo-mark.webp"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover ring-1 ring-line"
            />
            <span className="font-display text-sm font-extrabold uppercase tracking-wide text-fg">
              Admin <span className="text-brand">Panel</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <span className="hidden rounded-full bg-well px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-fg-soft sm:inline">
              {userName} · {ROLE_LABELS[role]}
            </span>
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

      {/* Sidebar escritorio */}
      <aside
        aria-label="Menú del panel"
        className="fixed bottom-0 left-0 top-14 z-30 hidden w-60 overflow-y-auto border-r border-line bg-bg2 px-3 py-6 lg:block"
      >
        <nav className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-fg-faint">
                {group.title}
              </p>
              <div className="mt-1.5 flex flex-col gap-1">
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
        </nav>
      </aside>

      <main className="mx-auto w-full max-w-4xl px-4 pb-28 pt-20 lg:ml-60 lg:px-8 lg:pb-16 lg:pt-24 xl:mx-auto">
        {children}
      </main>

      {/* Navegación inferior móvil: 3 accesos + Más */}
      <nav
        aria-label="Navegación del panel"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg2/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="grid grid-cols-4">
          {mobileMain.map((item) => {
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
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-expanded={moreOpen}
            className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-bold text-fg-soft"
          >
            <IconMenu width={21} height={21} />
            Más
          </button>
        </div>
      </nav>

      {/* Menú completo móvil */}
      {moreOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menú completo"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="modal-in max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl border-t border-line bg-bg2 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-fg-faint">
                {userName} · {ROLE_LABELS[role]}
              </p>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Cerrar menú"
                className="flex h-11 w-11 items-center justify-center rounded-xl bg-well text-fg-soft"
              >
                <IconX width={18} height={18} />
              </button>
            </div>
            {groups.map((group) => (
              <div key={group.title} className="mt-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-fg-faint">
                  {group.title}
                </p>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={`flex min-h-12 items-center gap-2.5 rounded-xl border px-3 text-sm font-semibold ${
                        isActive(item.href, item.exact)
                          ? "border-brand/50 bg-brand/10 text-fg"
                          : "border-line bg-card text-fg-soft"
                      }`}
                    >
                      <item.icon width={16} height={16} className="shrink-0 text-brand" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <span className="sr-only" aria-hidden="true">
        <IconChevronDown width={1} height={1} />
      </span>
    </div>
  );
}
