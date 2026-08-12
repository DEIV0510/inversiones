"use client";

import { useState } from "react";
import { waLink } from "@/lib/whatsapp";
import { IconTicket, IconWhatsApp, IconX } from "@/components/icons";

type Props = {
  whatsappNumber: string;
  variant?: "pill" | "bar";
  className?: string;
};

/**
 * Botón "Mis boletas": preparado para el futuro sistema de boletas/números.
 * En esta primera fase abre un modal que dirige la consulta a WhatsApp.
 */
export default function MisBoletasButton({
  whatsappNumber,
  variant = "pill",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {variant === "pill" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-well px-4 text-sm font-bold text-fg transition-colors hover:border-brand ${className}`}
        >
          <IconTicket width={17} height={17} className="text-brand" />
          Mis boletas
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-bold text-fg-soft transition-colors hover:text-fg ${className}`}
        >
          <IconTicket width={21} height={21} />
          Mis boletas
        </button>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Mis boletas"
          onClick={() => setOpen(false)}
        >
          <div
            className="neon-card modal-in w-full max-w-md rounded-t-3xl bg-card p-6 text-center sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-well text-fg-soft transition-colors hover:text-fg"
              >
                <IconX width={18} height={18} />
              </button>
            </div>
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand/15 text-brand">
              <IconTicket width={30} height={30} />
            </span>
            <h3 className="mt-4 font-display text-xl font-extrabold uppercase text-fg">
              Mis boletas
            </h3>
            <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-fg-soft">
              Muy pronto podrás consultar tus boletas aquí. Por ahora,
              escríbenos por WhatsApp y te confirmamos tu participación al
              instante.
            </p>
            <a
              href={waLink(
                whatsappNumber,
                "Hola, quiero consultar mis boletas de los sorteos de Inversiones D y S."
              )}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="glow-wa mt-5 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-wa px-5 text-sm font-bold uppercase tracking-wide text-white transition-all hover:bg-wa-dark"
            >
              <IconWhatsApp width={19} height={19} />
              Consultar por WhatsApp
            </a>
          </div>
        </div>
      ) : null}
    </>
  );
}
