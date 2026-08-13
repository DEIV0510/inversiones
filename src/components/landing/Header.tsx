"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MisBoletasButton from "./MisBoletasButton";
import { waGeneral } from "@/lib/whatsapp";
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
};

export default function Header({ whatsappNumber, companyName }: Props) {
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
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-300 ${
        scrolled || open
          ? "border-line bg-bg/90 backdrop-blur-md"
          : "border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/#inicio"
          className="flex items-center gap-2.5 font-display"
          aria-label={`${companyName} — inicio`}
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/img/logo-mark.webp"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover ring-1 ring-line"
          />
          <span className="text-sm font-extrabold uppercase tracking-wide text-fg sm:text-base">
            Inversiones <span className="text-brand">D y S</span>
          </span>
        </Link>

        <nav
          className="hidden items-center gap-6 xl:flex"
          aria-label="Navegación principal"
        >
          {NAV_LINKS.slice(0, 6).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-fg-soft transition-colors hover:text-fg"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <MisBoletasButton whatsappNumber={whatsappNumber} />
          <a
            href={waGeneral(whatsappNumber)}
            target="_blank"
            rel="noopener noreferrer"
            className="glow-red-sm hidden min-h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark lg:inline-flex"
          >
            <IconWhatsApp width={16} height={16} />
            Participar
          </a>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="menu-movil"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-fg transition-colors hover:bg-well xl:hidden"
          >
            {open ? <IconX /> : <IconMenu />}
          </button>
        </div>
      </div>

      {/* Menú móvil */}
      <div
        id="menu-movil"
        className={`xl:hidden ${open ? "block" : "hidden"} border-t border-line bg-bg`}
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
          <a
            href={waGeneral(whatsappNumber)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="glow-red-sm mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark"
          >
            <IconWhatsApp width={18} height={18} />
            Quiero participar
          </a>
        </nav>
      </div>
    </header>
  );
}
