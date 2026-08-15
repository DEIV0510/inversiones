"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicRaffle } from "@/lib/public";
import { formatCop } from "@/lib/format";
import { useModalA11y } from "@/components/useModalA11y";
import { IconCheck, IconTicket, IconWhatsApp, IconX } from "@/components/icons";

type Suggestion = { value: number; label: string };
type SearchResult = {
  label: string;
  value: number;
  status: "DISPONIBLE" | "RESERVADO" | "VENDIDO" | "BLOQUEADO";
};

const inputCls =
  "min-h-12 w-full rounded-2xl border border-line bg-well px-4 text-base text-fg placeholder:text-fg-soft/70 focus:border-brand focus:outline-none";

/** Etiqueta pequeña: mayúsculas con tracking muy abierto. */
const labelCls = "text-xs font-bold uppercase tracking-[0.16em] text-fg-faint";

/**
 * Título de sección: punto fucsia con resplandor + texto display en
 * mayúsculas, igual que en la plataforma de referencia.
 */
function TituloSeccion({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={`flex items-center gap-2.5 font-display text-lg font-black uppercase tracking-[0.06em] text-fg sm:text-xl ${className}`}
    >
      <span
        aria-hidden="true"
        className="glow-brand-sm h-[7px] w-[7px] shrink-0 rounded-full bg-brand"
      />
      {children}
    </h3>
  );
}

/**
 * Selección de números escalable: nunca se carga el universo completo.
 * Las dos formas de comprar van APILADAS en la misma pantalla (sin pestañas):
 * primero la compra rápida por paquetes y debajo la elección del número.
 * La disponibilidad SIEMPRE la decide el backend al reservar.
 * La forma de elegir (manual / azar / ambas) y los paquetes de boletas
 * vienen configurados en cada rifa desde el panel.
 */
export default function NumberPicker({ raffle }: { raffle: PublicRaffle }) {
  const router = useRouter();

  // Modo de selección configurado en la rifa. Cualquier valor desconocido
  // se trata como "ambas" para no dejar al usuario sin manera de comprar.
  const onlyManual = raffle.selectionMode === "MANUAL";
  const onlyRandom = raffle.selectionMode === "RANDOM";
  // Qué bloques se pintan: en "ambas" se ven los dos, uno debajo del otro.
  const verCompraRapida = !onlyManual;
  const verElegirNumero = !onlyRandom;

  // Paquetes definidos por el dueño: sin repetidos, ordenados y sin superar
  // el máximo por pedido. Si no hay paquetes, solo quedan los botones +/−.
  const packs = [...new Set(raffle.ticketPacks)]
    .filter(
      (n) => Number.isFinite(n) && n >= 1 && n <= raffle.maxNumbersPerOrder
    )
    .sort((a, b) => a - b)
    .slice(0, 12);

  const [selected, setSelected] = useState<Map<number, string>>(new Map());
  // Cantidad de la compra rápida. 0 = todavía no ha elegido paquete.
  const [randomQty, setRandomQty] = useState(0);

  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(!onlyRandom);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState("");

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const panelRef = useModalA11y(checkoutOpen, () => setCheckoutOpen(false));
  const abortRef = useRef<AbortController | null>(null);

  // Regla derivada (sustituye a las pestañas): si el comprador escogió
  // números a mano, el pedido lleva ESOS números; si no escogió ninguno pero
  // eligió una cantidad, el pedido lleva solo la cantidad.
  const usaNumerosElegidos = selected.size > 0;
  const quantity = usaNumerosElegidos ? selected.size : randomQty;
  const total = quantity * raffle.pricePerNumber;
  const canContinue = quantity > 0 && quantity <= raffle.maxNumbersPerOrder;

  const loadSuggestions = useCallback(async () => {
    // En modo "solo al azar" nunca se muestran sugerencias: no se pide nada.
    if (onlyRandom) return;
    // El estado ya arranca en "cargando" y quien recarga a mano lo vuelve a
    // encender; aquí no se toca para no renderizar de más al montar.
    try {
      const res = await fetch(
        `/api/public/raffles/${raffle.slug}/suggestions?count=24`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (res.ok) setSuggestions(data.suggestions ?? []);
    } catch {
      // sin sugerencias no se bloquea nada: queda el buscador
    } finally {
      setLoadingSuggestions(false);
    }
  }, [raffle.slug, onlyRandom]);

  useEffect(() => {
    // La primera carga se pide fuera del render: así el estado solo cambia
    // cuando llega la respuesta, sin encadenar renders al montar.
    let vivo = true;
    (async () => {
      await Promise.resolve();
      if (vivo) await loadSuggestions();
    })();
    return () => {
      vivo = false;
    };
  }, [loadSuggestions]);

  /** Elegir un número a mano cancela la cantidad de la compra rápida. */
  function toggle(value: number, label: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(value)) {
        next.delete(value);
      } else if (next.size < raffle.maxNumbersPerOrder) {
        next.set(value, label);
      }
      return next;
    });
    setRandomQty(0);
  }

  /** Elegir una cantidad rápida cancela los números escogidos a mano. */
  function elegirCantidad(n: number) {
    const q = Math.max(0, Math.min(raffle.maxNumbersPerOrder, n));
    setRandomQty(q);
    if (q > 0 && selected.size > 0) setSelected(new Map());
  }

  async function searchNumber(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchResult(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch(
        `/api/public/raffles/${raffle.slug}/number-status?n=${encodeURIComponent(query.trim())}`,
        { cache: "no-store", signal: controller.signal }
      );
      const data = await res.json();
      if (!res.ok) {
        setSearchError(data.error || "No fue posible consultar");
        return;
      }
      setSearchResult(data);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setSearchError("Error de conexión. Intenta de nuevo.");
      }
    } finally {
      setSearching(false);
    }
  }

  async function submitOrder() {
    if (name.trim().length < 2) {
      setFormError("Escribe tu nombre completo");
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      setFormError("Escribe tu número de WhatsApp");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      const body = usaNumerosElegidos
        ? {
            raffleSlug: raffle.slug,
            name,
            phone,
            email,
            numbers: [...selected.keys()],
          }
        : { raffleSlug: raffle.slug, name, phone, email, randomCount: randomQty };
      const res = await fetch("/api/public/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409 && Array.isArray(data.conflicting) && data.conflicting.length > 0) {
          const perdidos: string[] = [];
          setSelected((prev) => {
            const next = new Map(prev);
            for (const n of data.conflicting) {
              const label = next.get(n);
              if (label) perdidos.push(label);
              next.delete(n);
            }
            return next;
          });
          setCheckoutOpen(false);
          setSearchResult(null);
          setLoadingSuggestions(true);
          loadSuggestions();
          setFormError("");
          setNotice(
            perdidos.length > 0
              ? `Otra persona tomó ${perdidos.length === 1 ? "el número" : "los números"} ${perdidos.join(", ")} antes que tú. Los quitamos de tu selección: elige otros y continúa.`
              : "Algunos números fueron tomados por otra persona. Revisa tu selección y continúa."
          );
          return;
        }
        setFormError(data.error || "No fue posible crear tu pedido");
        return;
      }
      // Si la rifa cierra por WhatsApp, el comprador pasa derecho a la
      // conversación con sus números y su código.
      router.push(
        raffle.whatsappCheckout
          ? `/pedido/${data.code}?enviar=1`
          : `/pedido/${data.code}`
      );
    } catch {
      setFormError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  // Colores de estado igual que la leyenda: pendiente = ámbar, pagado = fucsia.
  const statusChip: Record<SearchResult["status"], { text: string; cls: string }> = {
    DISPONIBLE: { text: "Disponible", cls: "bg-wa/15 text-wa" },
    RESERVADO: { text: "Reservado", cls: "bg-warn/15 text-warn" },
    VENDIDO: { text: "Vendido", cls: "bg-brand/20 text-brand-light" },
    BLOQUEADO: { text: "No disponible", cls: "bg-well text-fg-faint" },
  };

  // Leyenda de colores de las fichas. Solo explica los colores: nunca lleva
  // cantidades, porque al público jamás se le muestran números vendidos.
  const leyenda = [
    { texto: "Libres", punto: "bg-well ring-1 ring-line-strong" },
    { texto: "Pendientes", punto: "bg-warn" },
    { texto: "Pagados", punto: "bg-brand" },
  ] as const;

  return (
    <section id="elegir" className="mt-6 flex flex-col gap-7">
      {notice ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-2xl border border-brand/50 bg-brand/10 px-4 py-3"
        >
          <p className="text-sm leading-relaxed text-fg">{notice}</p>
          <button
            type="button"
            onClick={() => setNotice("")}
            aria-label="Cerrar aviso"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-fg-soft hover:text-fg"
          >
            <IconX width={16} height={16} />
          </button>
        </div>
      ) : null}

      {/* ── COMPRA RÁPIDA ─────────────────────────────────────────────
          Paquetes de boletas: la forma más directa de comprar. Al público
          nunca se le nombra "aleatorio": solo elige cuántas quiere. */}
      {verCompraRapida ? (
        <div>
          <TituloSeccion className="mb-3">Compra rápida</TituloSeccion>

          {packs.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {packs.map((n) => {
                const activo = randomQty === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => elegirCantidad(n)}
                    aria-pressed={activo}
                    className={`flex min-h-36 flex-col items-center justify-center gap-1 rounded-3xl border bg-card px-3 py-5 text-center transition-all active:scale-[0.99] sm:min-h-40 ${
                      activo
                        ? "glow-brand border-brand"
                        : "border-line hover:border-brand/60"
                    }`}
                  >
                    <span className="font-display text-[2.75rem] font-black leading-none tabular-nums text-brand sm:text-5xl">
                      {n}
                    </span>
                    <span className="text-sm text-fg-soft">
                      {n === 1 ? "Número" : "Números"}
                    </span>
                    <span className="mt-2 max-w-full rounded-full bg-brand px-3.5 py-1.5 font-display text-sm font-black tabular-nums text-white">
                      {formatCop(n * raffle.pricePerNumber)}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {/* Cantidad libre, por si quiere una distinta a los paquetes. */}
          <div
            className={`flex items-center justify-between gap-3 rounded-3xl border border-line bg-card px-4 py-3 ${
              packs.length > 0 ? "mt-3" : ""
            }`}
          >
            <span className={labelCls}>Otra cantidad</span>
            <span className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => elegirCantidad(randomQty - 1)}
                disabled={randomQty === 0}
                aria-label="Menos boletas"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-strong text-xl font-black text-fg transition-colors hover:border-brand disabled:opacity-40"
              >
                −
              </button>
              <span className="min-w-10 text-center font-display text-2xl font-black tabular-nums text-brand">
                {randomQty}
              </span>
              <button
                type="button"
                onClick={() => elegirCantidad(randomQty + 1)}
                aria-label="Más boletas"
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-strong text-xl font-black text-fg transition-colors hover:border-brand"
              >
                +
              </button>
            </span>
          </div>
        </div>
      ) : null}

      {/* ── ELIGE TU NÚMERO ───────────────────────────────────────────
          Buscador puntual + cuadrícula de sugerencias disponibles. */}
      {verElegirNumero ? (
        <div className="flex flex-col gap-4">
          <TituloSeccion>Elige tu número</TituloSeccion>

          {/* Buscador */}
          <form
            onSubmit={searchNumber}
            className="rounded-3xl border border-line bg-card p-4"
          >
            <label htmlFor="buscar-numero" className={`mb-2 block ${labelCls}`}>
              Busca tu número de la suerte
            </label>
            <div className="flex gap-2">
              <input
                id="buscar-numero"
                type="text"
                inputMode="numeric"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value.replace(/\D/g, "").slice(0, raffle.digits));
                  setSearchResult(null);
                  setSearchError("");
                }}
                className={`${inputCls} min-w-0 font-display text-lg font-bold tracking-[0.2em]`}
                placeholder={"0".repeat(raffle.digits)}
              />
              <button
                type="submit"
                disabled={searching || query.length === 0}
                className="min-h-12 shrink-0 rounded-2xl bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
              >
                {searching ? "…" : "Buscar"}
              </button>
            </div>
            {searchError ? (
              <p role="alert" className="mt-2 text-sm font-semibold text-error">
                {searchError}
              </p>
            ) : null}
            {searchResult ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-well px-4 py-3">
                <span className="font-display text-xl font-black tracking-[0.15em] text-brand">
                  {searchResult.label}
                </span>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${statusChip[searchResult.status].cls}`}
                >
                  {statusChip[searchResult.status].text}
                </span>
                {searchResult.status === "DISPONIBLE" ? (
                  <button
                    type="button"
                    onClick={() => {
                      toggle(searchResult.value, searchResult.label);
                      setQuery("");
                      setSearchResult(null);
                    }}
                    className="glow-brand-sm min-h-11 rounded-2xl bg-brand px-4 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-dark"
                  >
                    {selected.has(searchResult.value) ? "Quitar" : "Agregar"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </form>

          {/* Sugerencias disponibles */}
          <div className="rounded-3xl border border-line bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <span className={labelCls}>Números disponibles</span>
              <button
                type="button"
                onClick={() => {
                  setLoadingSuggestions(true);
                  loadSuggestions();
                }}
                disabled={loadingSuggestions}
                className="-mr-2 min-h-11 shrink-0 rounded-xl px-3 text-xs font-bold uppercase tracking-[0.16em] text-brand hover:bg-well disabled:opacity-50"
              >
                Ver otros
              </button>
            </div>
            {loadingSuggestions ? (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-11 animate-pulse rounded-full bg-well"
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : suggestions.length > 0 ? (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {suggestions.map((s) => {
                  const isSelected = selected.has(s.value);
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => toggle(s.value, s.label)}
                      aria-pressed={isSelected}
                      className={`min-h-11 overflow-hidden rounded-full px-1 font-display text-[13px] font-black tracking-wider tabular-nums transition-all sm:text-sm ${
                        isSelected
                          ? "glow-brand-sm bg-brand text-white"
                          : "border border-line bg-well text-fg hover:border-brand"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-sm text-fg-soft">
                No hay sugerencias en este momento. Usa el buscador.
              </p>
            )}

            {/* Leyenda de colores: sin cantidades ni contadores. */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 border-t border-line pt-3">
              {leyenda.map((l) => (
                <span
                  key={l.texto}
                  className={`flex items-center gap-1.5 ${labelCls}`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2.5 w-2.5 shrink-0 rounded-full ${l.punto}`}
                  />
                  {l.texto}
                </span>
              ))}
            </div>

            <p className="mt-3 text-center text-xs text-fg-faint">
              Máximo {raffle.maxNumbersPerOrder} números por pedido.
            </p>
          </div>

          {/* Selección actual */}
          {selected.size > 0 ? (
            <div className="rounded-3xl border border-brand/40 bg-card p-4">
              <p className={labelCls}>Números seleccionados</p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                {[...selected.entries()].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggle(value, label)}
                    aria-label={`Quitar número ${label}`}
                    className="ticket-chip group inline-flex min-h-11 items-center gap-1.5 rounded-full px-3.5 font-display text-sm font-black tracking-wider tabular-nums text-white"
                  >
                    {label}
                    <IconX width={13} height={13} className="opacity-70 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Barra de resumen: refleja siempre lo que se va a comprar. Se apoya
          encima de la navegación inferior y del aviso de demostración para que
          "Continuar" quede siempre destapado y se pueda pulsar. */}
      <div
        style={{ bottom: "calc(var(--barra-inferior-h) + var(--aviso-demo-h))" }}
        className={`fixed inset-x-0 z-30 transition-all duration-300 ${
          canContinue
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-full opacity-0"
        }`}
      >
        <div className="mx-auto w-full max-w-3xl px-4 pb-3">
          <div className="neon-card flex items-center justify-between gap-3 rounded-3xl bg-card px-4 py-3">
            <div className="min-w-0">
              <p className={labelCls}>
                {quantity} {quantity === 1 ? "número" : "números"}
              </p>
              <p className="font-display text-xl font-black tabular-nums text-brand">
                {formatCop(total)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormError("");
                setCheckoutOpen(true);
              }}
              className="glow-brand-sm inline-flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-brand px-6 text-sm font-bold uppercase tracking-wide text-white transition-all hover:bg-brand-dark active:scale-[0.98]"
            >
              <IconTicket width={17} height={17} />
              Continuar
            </button>
          </div>
        </div>
      </div>

      {/* Modal de datos */}
      {checkoutOpen ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar compra"
          onClick={() => setCheckoutOpen(false)}
        >
          {/* Panel con borde fucsia neón de 2px y resplandor exterior. */}
          <div
            ref={panelRef}
            tabIndex={-1}
            className="glow-brand modal-in max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border-2 border-brand bg-card p-5 outline-none sm:rounded-3xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display text-xl font-black uppercase tracking-[0.04em] text-fg">
                Confirmar compra
              </h3>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                aria-label="Cerrar"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-well text-fg-soft hover:text-fg"
              >
                <IconX width={18} height={18} />
              </button>
            </div>

            {/* Importe enorme centrado, con el detalle debajo. */}
            <div className="mt-4 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-light">
                {raffle.title}
              </p>
              <p className="mt-1.5 font-display text-4xl font-black tabular-nums text-fg sm:text-5xl">
                {formatCop(total)}
              </p>
              <p className="mt-1 text-sm text-fg-soft">
                Por {quantity} {quantity === 1 ? "número" : "números"}
              </p>
              {usaNumerosElegidos ? (
                <p className="mt-1.5 truncate font-display text-xs tracking-wider text-fg-faint">
                  {[...selected.values()].join(" · ")}
                </p>
              ) : null}
            </div>

            <div className="mt-5 flex flex-col gap-3.5">
              <div>
                <label htmlFor="co-name" className="mb-1.5 block text-sm font-semibold text-fg">
                  Tu nombre completo
                </label>
                <input
                  id="co-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  placeholder="Ej: Juan Pérez"
                  maxLength={120}
                  autoComplete="name"
                />
              </div>
              <div>
                <label htmlFor="co-phone" className="mb-1.5 block text-sm font-semibold text-fg">
                  Tu WhatsApp
                </label>
                <input
                  id="co-phone"
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
              <div>
                <label htmlFor="co-email" className="mb-1.5 block text-sm font-semibold text-fg">
                  Correo <span className="font-normal text-fg-faint">(opcional)</span>
                </label>
                <input
                  id="co-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="tucorreo@ejemplo.com"
                  maxLength={200}
                  autoComplete="email"
                />
              </div>

              {formError ? (
                <p role="alert" className="text-sm font-semibold text-error">
                  {formError}
                </p>
              ) : null}

              {/* Botón de cierre a lo ancho: verde WhatsApp solo si la rifa
                  cierra por WhatsApp; si no, fucsia y sin rastro de WhatsApp. */}
              <button
                type="button"
                onClick={submitOrder}
                disabled={submitting}
                className={`mt-1 inline-flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl px-5 text-base font-black transition-all disabled:opacity-60 ${
                  raffle.whatsappCheckout
                    ? "glow-wa bg-wa text-white hover:bg-wa-dark"
                    : "glow-brand bg-brand text-white hover:bg-brand-dark"
                }`}
              >
                {submitting ? (
                  "Reservando…"
                ) : raffle.whatsappCheckout ? (
                  <>
                    <IconWhatsApp width={19} height={19} />
                    Pagar por WhatsApp
                  </>
                ) : (
                  <>
                    <IconCheck width={18} height={18} />
                    Reservar mis números
                  </>
                )}
              </button>
              <p className="text-center text-xs leading-relaxed text-fg-faint">
                Tus números quedan reservados {raffle.reservationMinutes} minutos
                mientras completas el pago.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
