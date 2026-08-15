"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { waGeneral } from "@/lib/whatsapp";
import { IconTicket } from "@/components/icons";
import { IconMenu, IconWhatsApp, IconX } from "@/components/icons";

const NAV_LINKS = [
  { href: "/#inicio", label: "Inicio" },
  { href: "/#sorteos", label: "Sorteos" },
  { href: "/#premios", label: "Premios" },
  { href: "/#como-participar", label: "Cómo participar" },
  { href: "/#ganadores", label: "Ganadores" },
  { href: "/#faq", label: "Preguntas frecuentes" },
  { href: "/#contacto", label: "Contacto" },
];

type Props = {
  whatsappNumber: string;
  companyName: string;
  /** Rifas configuradas sin WhatsApp: no se le ofrece al comprador. */
  hideWhatsApp?: boolean;
};

export default function Header({
  whatsappNumber,
  companyName,
  hideWhatsApp,
}: Props) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    /* Barra fija muy oscura rematada por una línea fucsia finísima. */
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        scrolled || open
          ? "border-brand/40 bg-bg/90 backdrop-blur-md"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <Link
          href="/#inicio"
          className="flex min-w-0 items-center gap-2 sm:gap-2.5"
          aria-label={`${companyName} — inicio`}
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/logo-mark.webp"
            alt=""
            width={40}
            height={40}
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-line sm:h-10 sm:w-10"
          />
          {/* Nombre en dos líneas con degradado fucsia, como la referencia. */}
          <span className="brand-gradient flex min-w-0 flex-col overflow-hidden font-display text-[13px] font-extrabold uppercase leading-[1.08] tracking-[0.05em] sm:text-lg">
            <span>Inversiones</span>
            <span>D y S</span>
          </span>
        </Link>

        {/* Menú de escritorio: los enlaces largos solo aparecen cuando hay
            ancho de sobra; en pantallas menores queda el menú completo. */}
        <nav
          className="hidden items-center gap-4 xl:flex"
          aria-label="Navegación principal"
        >
          {NAV_LINKS.slice(0, 6).map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap text-[13px] font-semibold text-fg-soft transition-colors hover:text-fg ${
                i >= 4 ? "hidden 2xl:inline" : ""
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Pastilla oscura siempre visible: en móvil el texto va en dos
              líneas para que nada se desborde a 360px de ancho. */}
          <Link
            href="/boletas"
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-2xl border border-line-strong bg-well px-2.5 text-fg transition-colors hover:border-brand sm:gap-2 sm:rounded-full sm:px-4"
          >
            <IconTicket width={18} height={18} className="shrink-0 text-brand" />
            <span className="flex flex-col text-[11px] font-bold uppercase leading-[1.1] tracking-[0.08em] sm:flex-row sm:gap-1 sm:text-[13px] sm:tracking-normal">
              <span>Mis</span>
              <span>Boletas</span>
            </span>
          </Link>
          {hideWhatsApp ? null : (
            <a
              href={waGeneral(whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="glow-brand-sm hidden min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark lg:inline-flex"
            >
              <IconWhatsApp width={16} height={16} />
              Participar
            </a>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-fg transition-colors hover:bg-well 2xl:hidden"
          >
            {open ? <IconX /> : <IconMenu />}
          </button>
        </div>
      </div>

      {/* Menú móvil */}
      <div
        id="menu-movil"
        className={`2xl:hidden ${open ? "block" : "hidden"} border-t border-line bg-bg`}
      >
        <nav
          className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-4 py-4 sm:px-6"
          aria-label="Navegación móvil"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-3 py-3.5 text-base font-semibold text-fg transition-colors hover:bg-well hover:text-brand"
            >
              {link.label}
            </Link>
          ))}
          {hideWhatsApp ? null : (
            <a
              href={waGeneral(whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="glow-brand-sm mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark"
            >
              <IconWhatsApp width={18} height={18} />
              Quiero participar
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
