"use client";

import Link from "next/link";
import MisBoletasButton from "./MisBoletasButton";
import { waGeneral } from "@/lib/whatsapp";
import { IconHome, IconTicket, IconWhatsApp } from "@/components/icons";

type Props = {
  whatsappNumber: string;
};

/**
 * Barra de acción inferior fija en móvil (sensación de app):
 * Inicio | Sorteos | Mis boletas | WhatsApp.
 */
export default function BottomBar({ whatsappNumber }: Props) {
  return (
    <nav
      aria-label="Acciones rápidas"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/95 backdrop-blur-md lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        <Link
          href="/#inicio"
          className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-bold text-fg-soft transition-colors hover:text-fg"
        >
          <IconHome width={21} height={21} />
          Inicio
        </Link>
        <Link
          href="/#sorteos"
          className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-bold text-fg-soft transition-colors hover:text-fg"
        >
          <IconTicket width={21} height={21} />
          Sorteos
        </Link>
        <MisBoletasButton whatsappNumber={whatsappNumber} variant="bar" />
        <a
          href={waGeneral(whatsappNumber)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-bold text-wa transition-colors hover:text-white"
        >
          <span className="glow-wa flex h-8 w-8 items-center justify-center rounded-full bg-wa text-white">
            <IconWhatsApp width={17} height={17} />
          </span>
          WhatsApp
        </a>
      </div>
    </nav>
  );
}
