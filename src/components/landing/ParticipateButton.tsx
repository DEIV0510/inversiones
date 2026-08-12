"use client";

import { useState } from "react";
import { formatCop } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { IconWhatsApp, IconX } from "@/components/icons";

type Props = {
  raffleTitle: string;
  priceCop: number | null;
  whatsappNumber: string;
  /** big = CTA del sorteo destacado */
  size?: "big" | "normal";
  className?: string;
};

const inputCls =
  "min-h-12 w-full rounded-xl border border-line bg-well px-4 text-base text-fg placeholder:text-fg-faint focus:border-brand focus:outline-none";

/**
 * CTA "Quiero participar": abre un modal con los datos del sorteo y campos
 * de nombre y WhatsApp, y continúa la conversión directamente en WhatsApp.
 */
export default function ParticipateButton({
  raffleTitle,
  priceCop,
  whatsappNumber,
  size = "normal",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");

  function continueToWhatsApp() {
    if (name.trim().length < 2) {
      setError("Escribe tu nombre para continuar");
      return;
    }
    const intro = `Hola, soy ${name.trim()}. Quiero participar en el sorteo ${raffleTitle} de Inversiones D y S.`;
    const tel = phone.replace(/\D/g, "");
    const message = tel ? `${intro} Mi WhatsApp: ${tel}.` : intro;
    window.open(waLink(whatsappNumber, message), "_blank", "noopener,noreferrer");
    setOpen(false);
    setName("");
    setPhone("");
    setError("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`glow-red-sm inline-flex items-center justify-center gap-2 rounded-xl bg-brand font-bold uppercase tracking-wide text-white transition-all hover:bg-brand-dark active:scale-[0.98] ${
          size === "big" ? "min-h-14 px-8 text-base glow-red" : "min-h-12 px-5 text-sm"
        } ${className}`}
      >
        <IconWhatsApp width={size === "big" ? 20 : 18} height={size === "big" ? 20 : 18} />
        Quiero participar
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Participar en ${raffleTitle}`}
          onClick={() => setOpen(false)}
        >
          <div
            className="neon-card modal-in w-full max-w-md rounded-t-3xl bg-card p-6 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">
                  Quiero participar
                </p>
                <h3 className="mt-1.5 font-display text-xl font-extrabold uppercase leading-tight text-fg">
                  {raffleTitle}
                </h3>
                {priceCop != null ? (
                  <p className="mt-2 font-display text-2xl font-black tabular-nums text-fg">
                    {formatCop(priceCop)}{" "}
                    <span className="text-sm font-semibold text-fg-soft">
                      por participación
                    </span>
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-well text-fg-soft transition-colors hover:text-fg"
              >
                <IconX width={18} height={18} />
              </button>
            </div>

            <div className="mt-5 flex flex-col gap-4">
              <div>
                <label
                  htmlFor={`p-name-${raffleTitle}`}
                  className="mb-1.5 block text-sm font-semibold text-fg"
                >
                  Tu nombre completo
                </label>
                <input
                  id={`p-name-${raffleTitle}`}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  placeholder="Ej: Juan Pérez"
                  maxLength={80}
                  autoComplete="name"
                />
              </div>
              <div>
                <label
                  htmlFor={`p-phone-${raffleTitle}`}
                  className="mb-1.5 block text-sm font-semibold text-fg"
                >
                  Tu WhatsApp <span className="font-normal text-fg-faint">(opcional)</span>
                </label>
                <input
                  id={`p-phone-${raffleTitle}`}
                  type="tel"
                  inputMode="numeric"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputCls}
                  placeholder="Ej: 3001234567"
                  maxLength={15}
                  autoComplete="tel"
                />
              </div>

              {error ? (
                <p role="alert" className="text-sm font-semibold text-brand">
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                onClick={continueToWhatsApp}
                className="glow-wa inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-wa px-5 text-sm font-bold uppercase tracking-wide text-white transition-all hover:bg-wa-dark active:scale-[0.98]"
              >
                <IconWhatsApp width={19} height={19} />
                Continuar por WhatsApp
              </button>
              <p className="text-center text-xs leading-relaxed text-fg-faint">
                Te atenderemos personalmente para completar tu participación.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
