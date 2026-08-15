"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminRole } from "@prisma/client";
import { can, type Permission, ROLE_LABELS } from "@/lib/rbac";
import {
  IconCalendar,
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

/* Lenguaje visual del cajón: pastilla muy redondeada; la activa se enciende
   en fucsia translúcido con borde y resplandor de marca. */
const navItemCls =
  "flex min-h-11 items-center gap-3 rounded-2xl border px-3.5 text-sm font-semibold transition-colors";
const navItemActiveCls = "glow-brand-sm border-brand/60 bg-brand/15 text-brand";
const navItemIdleCls =
  "border-transparent text-fg-soft hover:border-line hover:bg-well hover:text-fg";
/* Epígrafe de grupo: mayúsculas diminutas, violeta claro y muy espaciadas. */
const groupTitleCls =
  "px-3.5 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-violet";
/* Botón redondeado oscuro de la barra superior. */
const barBtnCls =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-line bg-well/60 text-xs font-bold uppercase tracking-[0.12em] text-fg-soft transition-colors hover:border-brand/60 hover:text-fg";

/** Identidad del cajón, como en la referencia: título degradado + bajada. */
function PanelBrand() {
  return (
    <div>
      <p className="brand-gradient font-display text-lg font-extrabold uppercase tracking-[0.12em]">
        Admin Panel
      </p>
      <p className="mt-1 text-[13px] font-semibold text-brand-violet/80">
        Panel de Control
      </p>
    </div>
  );
}

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
      {/* Barra superior: marca a la izquierda, botones redondeados oscuros a la derecha */}
      <header className="fixed inset-x-0 top-0 z-40 border-b border-line bg-bg2/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between gap-2 px-4 lg:px-6">
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/img/logo-mark.webp"
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-line"
            />
            {/* Nombre de la marca en dos líneas con degradado, como la landing. */}
            <span className="brand-gradient flex min-w-0 flex-col font-display text-[11px] font-extrabold uppercase leading-[1.1] tracking-[0.06em] sm:text-sm">
              <span>Inversiones</span>
              <span>D y S</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden rounded-full border border-line bg-well/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-fg-soft sm:inline">
              {userName} · {ROLE_LABELS[role]}
            </span>
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className={`${barBtnCls} px-3.5`}
            >
              Ver sitio
            </Link>
            <button
              type="button"
              onClick={logout}
              disabled={loggingOut}
              aria-label="Cerrar sesión"
              className={`${barBtnCls} h-11 w-11 disabled:opacity-50`}
            >
              <IconLogOut width={18} height={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Cajón lateral de escritorio */}
      <aside
        aria-label="Menú del panel"
        className="fixed bottom-0 left-0 top-14 z-30 hidden w-60 overflow-y-auto border-r border-line bg-bg2 px-3 pb-8 pt-6 lg:block"
      >
        <div className="px-3.5">
          <PanelBrand />
        </div>
        <div className="mx-3.5 mt-5 border-t border-line" />
        <nav className="mt-6 flex flex-col gap-6">
          {groups.map((group) => (
            <div key={group.title}>
              <p className={groupTitleCls}>{group.title}</p>
              <div className="mt-2 flex flex-col gap-1">
                {group.items.map((item) => {
                  const active = isActive(item.href, item.exact);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`${navItemCls} ${
                        active ? navItemActiveCls : navItemIdleCls
                      }`}
                    >
                      <item.icon width={17} height={17} className="shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* El relleno izquierdo reserva el cajón: así la columna nunca queda
          debajo de él al centrarse en pantallas anchas. */}
      <main className="lg:pl-60">
        <div className="mx-auto w-full max-w-4xl px-4 pb-28 pt-20 lg:px-8 lg:pb-16 lg:pt-24">
          {children}
        </div>
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
                className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${
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
            className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-[0.08em] transition-colors ${
              moreOpen ? "text-brand" : "text-fg-soft"
            }`}
          >
            <IconMenu width={21} height={21} />
            Más
          </button>
        </div>
      </nav>

      {/* Menú completo móvil: mismo lenguaje que el cajón de escritorio */}
      {moreOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menú completo"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="modal-in max-h-[80dvh] w-full overflow-y-auto rounded-t-3xl border-t border-line-strong bg-bg2 p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              aria-hidden="true"
              className="mx-auto mb-4 block h-1 w-10 rounded-full bg-line-strong"
            />
            <div className="flex items-start justify-between gap-3">
              <PanelBrand />
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Cerrar menú"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line bg-well/60 text-fg-soft"
              >
                <IconX width={18} height={18} />
              </button>
            </div>
            <p className="mt-3 inline-flex rounded-full border border-line bg-well/60 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-fg-faint">
              {userName} · {ROLE_LABELS[role]}
            </p>
            {groups.map((group) => (
              <div key={group.title} className="mt-5">
                <p className="px-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-violet">
                  {group.title}
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  {group.items.map((item) => {
                    const active = isActive(item.href, item.exact);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMoreOpen(false)}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-12 items-center gap-2.5 rounded-2xl border px-3 text-sm font-semibold ${
                          active
                            ? "glow-brand-sm border-brand/60 bg-brand/15 text-brand"
                            : "border-line bg-card text-fg-soft"
                        }`}
                      >
                        <item.icon
                          width={16}
                          height={16}
                          className={`shrink-0 ${active ? "" : "text-brand-violet"}`}
                        />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
