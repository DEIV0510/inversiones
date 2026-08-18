"use client";

import Link from "next/link";
import { useState } from "react";
import { formatCop } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";
import { IconCandado, IconTicket, IconWhatsApp } from "@/components/icons";

/* Campo tipo "pozo": fondo well, borde tenue y foco fucsia con halo. */
const inputCls =
  "min-h-13 w-full rounded-2xl border border-line bg-well px-4 text-base text-fg transition-colors placeholder:text-fg-faint/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/35";

type LookupOrder = {
  code: string;
  raffleTitle: string;
  drawDateText: string | null;
  numbers: string[];
  quantity: number;
  total: number;
  status: string;
  createdAt: string;
  paidAt: string | null;
};

const STATUS_LABELS: Record<string, { text: string; cls: string }> = {
  PAID: { text: "Pagada", cls: "bg-wa/15 text-wa" },
  PENDING: { text: "Pendiente de pago", cls: "bg-well text-fg-soft" },
  EXPIRED: { text: "Expirada", cls: "bg-well text-fg-faint" },
  CANCELLED: { text: "Cancelada", cls: "bg-well text-fg-faint" },
  REJECTED: { text: "En revisión", cls: "bg-brand-deep/40 text-error" },
};

/** Etiqueta de sección: punto fucsia encendido + título display en mayúsculas. */
function TituloSeccion({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 font-display text-base font-black uppercase tracking-wide text-fg">
      <span
        aria-hidden="true"
        className="glow-brand-sm h-[7px] w-[7px] shrink-0 rounded-full bg-brand"
      />
      {children}
    </h2>
  );
}

type Props = {
  /**
   * Número de WhatsApp. Solo llega cuando la pantalla tiene permitido
   * ofrecer WhatsApp; si está oculto, la página no lo envía.
   */
  whatsappNumber?: string;
  /**
   * true cuando ninguna rifa pública cierra por WhatsApp: el formulario
   * oculta sus bloques de WhatsApp por completo, texto incluido.
   */
  hideWhatsApp?: boolean;
};

export default function LookupForm({ whatsappNumber, hideWhatsApp }: Props) {
  // Un solo campo: el comprador escribe lo que tenga a mano (celular, correo,
  // cédula o código de compra) y el servidor deduce qué es.
  const [dato, setDato] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    participant: { name: string };
    orders: LookupOrder[];
  } | null>(null);

  // Solo se ofrece WhatsApp si la pantalla lo permite y hay número válido.
  const numeroWa = (whatsappNumber ?? "").trim();
  const puedeWhatsApp = !hideWhatsApp && numeroWa !== "";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/public/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: dato }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible consultar");
        return;
      }
      setResult(data);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 flex flex-col gap-5">
      <form
        onSubmit={onSubmit}
        className="neon-card flex flex-col gap-4 rounded-3xl bg-card p-5 sm:p-6"
      >
        <TituloSeccion>Consulta tus boletas</TituloSeccion>
        <div>
          <label
            htmlFor="lk-dato"
            className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-fg-faint"
          >
            Tu celular, tu correo, tu cédula o el código de tu compra
          </label>
          <input
            id="lk-dato"
            type="text"
            /* Texto libre: puede llegar un correo, una cédula o un código, así
               que ni teclado numérico ni autocorrección ni mayúscula inicial. */
            required
            value={dato}
            onChange={(e) => setDato(e.target.value)}
            className={inputCls}
            placeholder="Ej: 3001234567"
            maxLength={120}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="lk-dato-ayuda"
          />
          <p
            id="lk-dato-ayuda"
            className="mt-1.5 text-xs leading-relaxed text-fg-faint"
          >
            Con uno solo basta. Por ejemplo:{" "}
            <span className="text-fg-soft">3001234567</span> (celular),{" "}
            <span className="break-all text-fg-soft">correo@ejemplo.com</span>,{" "}
            <span className="text-fg-soft">1098765432</span> (cédula) o{" "}
            <span className="text-fg-soft">ABC12345</span> (código de tu compra).
          </p>
        </div>
        {error ? (
          <p role="alert" className="text-sm font-semibold text-error">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={loading}
          className="glow-brand inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-brand px-5 font-display text-sm font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          <IconTicket width={18} height={18} />
          {loading ? "Consultando…" : "Consultar mis boletas"}
        </button>
        {puedeWhatsApp ? (
          <p className="text-center text-xs leading-relaxed text-fg-faint">
            ¿No aparecen tus boletas?{" "}
            <a
              href={waLink(
                numeroWa,
                "Hola, no encuentro mis boletas en la consulta de la página."
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-fg-soft underline-offset-2 hover:underline"
            >
              Escríbenos por WhatsApp
            </a>
          </p>
        ) : (
          /* Sin WhatsApp: redacción neutra, sin sugerir ningún canal. */
          <p className="text-center text-xs leading-relaxed text-fg-faint">
            ¿No aparecen tus boletas? Prueba con el mismo dato que usaste al
            comprar, o con el código de tu comprobante.
          </p>
        )}
      </form>

      {result ? (
        <div className="flex flex-col gap-3">
          <TituloSeccion>Tus participaciones</TituloSeccion>
          <p className="text-sm text-fg-soft">
            Hola <strong className="text-fg">{result.participant.name}</strong>,
            toca una participación para ver el detalle.
          </p>
          {result.orders.map((o) => {
            const meta = STATUS_LABELS[o.status] ?? STATUS_LABELS.PENDING;
            return (
              <Link
                key={o.code}
                href={`/pedido/${o.code}`}
                className="rounded-2xl border border-line bg-card p-4 transition-colors hover:border-brand/60"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="font-display text-sm font-extrabold uppercase text-fg">
                    {o.raffleTitle}
                  </p>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${meta.cls}`}
                  >
                    {meta.text}
                  </span>
                </div>
                {o.status === "PAID" ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {o.numbers.slice(0, 10).map((n) => (
                      <span
                        key={n}
                        className="rounded-md bg-well px-2 py-1 font-display text-xs font-bold tracking-wider text-fg"
                      >
                        {n}
                      </span>
                    ))}
                    {o.numbers.length > 10 ? (
                      <span className="px-1 py-1 text-xs text-fg-faint">
                        +{o.numbers.length - 10} más
                      </span>
                    ) : null}
                  </div>
                ) : (
                  /* Sin pago confirmado los números van tapados: aquí ni
                     siquiera llegan desde el servidor. Se muestran fichas del
                     mismo tamaño para que se vea cuántas boletas son. */
                  <div className="mt-2">
                    <div className="flex flex-wrap gap-1.5" aria-hidden="true">
                      {Array.from({
                        length: Math.min(10, Math.max(0, o.quantity)),
                      }).map((_, i) => (
                        <span
                          key={i}
                          className="rounded-md border border-dashed border-line-strong bg-well px-2 py-1 font-display text-xs font-bold tracking-wider text-fg-faint"
                        >
                          ••••
                        </span>
                      ))}
                      {o.quantity > 10 ? (
                        <span className="px-1 py-1 text-xs text-fg-faint">
                          +{o.quantity - 10} más
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs leading-relaxed text-fg-faint">
                      <IconCandado width={13} height={13} className="shrink-0" />
                      {o.quantity === 1
                        ? "1 número apartado a tu nombre. Lo verás al confirmarse el pago."
                        : `${o.quantity} números apartados a tu nombre. Los verás al confirmarse el pago.`}
                    </p>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between text-xs text-fg-faint">
                  <span>Código {o.code}</span>
                  <span className="font-display text-sm font-black tabular-nums text-fg">
                    {formatCop(o.total)}
                  </span>
                </div>
              </Link>
            );
          })}
          {puedeWhatsApp ? (
            <a
              href={waLink(numeroWa, "Hola, tengo una consulta sobre mis boletas.")}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line-strong px-5 text-sm font-bold uppercase tracking-wide text-fg-soft hover:border-brand hover:text-fg"
            >
              <IconWhatsApp width={17} height={17} />
              ¿Dudas? Escríbenos
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
