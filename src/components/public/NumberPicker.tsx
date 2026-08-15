"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicRaffle } from "@/lib/public";
import { formatCop } from "@/lib/format";
import { useModalA11y } from "@/components/useModalA11y";
import { IconCheck, IconTicket, IconX } from "@/components/icons";

type Suggestion = { value: number; label: string };
type SearchResult = {
  label: string;
  value: number;
  status: "DISPONIBLE" | "RESERVADO" | "VENDIDO" | "BLOQUEADO";
};

const inputCls =
  "min-h-12 w-full rounded-xl border border-line bg-well px-4 text-base text-fg placeholder:text-fg-soft/70 focus:border-brand focus:outline-none";

/**
 * Selección de números escalable: nunca se carga el universo completo.
 * Cuadrícula de sugerencias disponibles + buscador puntual + modo azar.
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
  const showTabs = !onlyManual && !onlyRandom;

  // Paquetes definidos por el dueño: sin repetidos, ordenados y sin superar
  // el máximo por pedido. Si no hay paquetes, solo quedan los botones +/−.
  const packs = [...new Set(raffle.ticketPacks)]
    .filter(
      (n) => Number.isFinite(n) && n >= 1 && n <= raffle.maxNumbersPerOrder
    )
    .sort((a, b) => a - b)
    .slice(0, 12);

  const [tab, setTab] = useState<"elegir" | "azar">(
    onlyRandom ? "azar" : "elegir"
  );
  const [selected, setSelected] = useState<Map<number, string>>(new Map());
  const [randomQty, setRandomQty] = useState(1);

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

  const quantity = tab === "azar" ? randomQty : selected.size;
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
      const body =
        tab === "azar"
          ? { raffleSlug: raffle.slug, name, phone, email, randomCount: randomQty }
          : {
              raffleSlug: raffle.slug,
              name,
              phone,
              email,
              numbers: [...selected.keys()],
            };
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

  const statusChip: Record<SearchResult["status"], { text: string; cls: string }> = {
    DISPONIBLE: { text: "Disponible", cls: "bg-wa/15 text-wa" },
    RESERVADO: { text: "Reservado", cls: "bg-well text-fg-soft" },
    VENDIDO: { text: "Vendido", cls: "bg-brand-deep/40 text-error" },
    BLOQUEADO: { text: "No disponible", cls: "bg-well text-fg-faint" },
  };

  return (
    <section id="elegir" className="mt-6">
      {notice ? (
        <div
          role="alert"
          className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-brand/50 bg-brand/10 px-4 py-3"
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

      {/* Cuando la rifa permite las dos formas, el cliente NUNCA ve las
          palabras "manual" ni "aleatorio": solo dos accesos claros. */}
      {showTabs ? (
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-card p-2">
          {(
            [
              ["azar", "Compra rápida"],
              ["elegir", "Escoger mis números"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={`min-h-11 rounded-xl text-sm font-bold uppercase tracking-wide transition-colors ${
                tab === key
                  ? "glow-red-sm bg-brand text-white"
                  : "text-fg-soft hover:text-fg"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "elegir" ? (
        <div className={`flex flex-col gap-4 ${showTabs ? "mt-4" : ""}`}>
          {/* Buscador */}
          <form
            onSubmit={searchNumber}
            className="rounded-2xl border border-line bg-card p-4"
          >
            <label
              htmlFor="buscar-numero"
              className="mb-1.5 block text-sm font-semibold text-fg"
            >
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
                className={`${inputCls} font-display text-lg font-bold tracking-[0.2em]`}
                placeholder={"0".repeat(raffle.digits)}
              />
              <button
                type="submit"
                disabled={searching || query.length === 0}
                className="min-h-12 shrink-0 rounded-xl bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
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
              <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-well px-4 py-3">
                <span className="font-display text-xl font-black tracking-[0.15em] text-fg">
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
                    className="glow-red-sm min-h-11 rounded-xl bg-brand px-4 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-dark"
                  >
                    {selected.has(searchResult.value) ? "Quitar" : "Agregar"}
                  </button>
                ) : null}
              </div>
            ) : null}
          </form>

          {/* Sugerencias disponibles */}
          <div className="rounded-2xl border border-line bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-fg">
                Números disponibles ahora
              </p>
              <button
                type="button"
                onClick={() => {
                  setLoadingSuggestions(true);
                  loadSuggestions();
                }}
                disabled={loadingSuggestions}
                className="min-h-10 rounded-lg px-3 text-xs font-bold uppercase tracking-wide text-brand hover:bg-well disabled:opacity-50"
              >
                Ver otros
              </button>
            </div>
            {loadingSuggestions ? (
              <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-11 animate-pulse rounded-xl bg-well"
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
                      className={`min-h-11 rounded-xl font-display text-sm font-bold tracking-wider transition-all ${
                        isSelected
                          ? "glow-red-sm bg-brand text-white"
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
            <p className="mt-3 text-xs text-fg-faint">
              Máximo {raffle.maxNumbersPerOrder} números por pedido.
            </p>
          </div>
        </div>
      ) : (
        <div className={showTabs ? "mt-4" : ""}>
          {/* Paquetes: la forma principal de comprar. Botones anchos, uno
              debajo del otro, con la cantidad y su precio total. */}
          {packs.length > 0 ? (
            <>
              <p className="mb-2.5 text-center font-display text-lg font-black uppercase tracking-wide text-fg">
                Adquiérelos
              </p>
              <div className="flex flex-col gap-2.5">
                {packs.map((n) => {
                  const activo = randomQty === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRandomQty(n)}
                      aria-pressed={activo}
                      className={`flex min-h-14 w-full items-center justify-center gap-2.5 rounded-xl px-4 text-center font-bold text-white transition-all active:scale-[0.99] ${
                        activo
                          ? "glow-red bg-brand ring-2 ring-white/70"
                          : "bg-brand hover:bg-brand-dark"
                      }`}
                    >
                      <IconTicket width={20} height={20} className="shrink-0" />
                      <span className="text-base tabular-nums sm:text-lg">
                        {n} {n === 1 ? "Número" : "Números"}{" "}
                        {formatCop(n * raffle.pricePerNumber)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : null}

          {/* Cantidad libre, por si quiere una distinta a los paquetes. */}
          <div className="mt-2.5 flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
            <span className="text-sm font-semibold text-fg">Otra cantidad</span>
            <span className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setRandomQty((q) => Math.max(1, q - 1))}
                aria-label="Menos boletas"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-line-strong text-xl font-black text-fg hover:border-brand"
              >
                −
              </button>
              <span className="min-w-10 text-center font-display text-2xl font-black tabular-nums text-fg">
                {randomQty}
              </span>
              <button
                type="button"
                onClick={() =>
                  setRandomQty((q) => Math.min(raffle.maxNumbersPerOrder, q + 1))
                }
                aria-label="Más boletas"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-line-strong text-xl font-black text-fg hover:border-brand"
              >
                +
              </button>
            </span>
          </div>
        </div>
      )}

      {/* Selección actual */}
      {tab === "elegir" && selected.size > 0 ? (
        <div className="mt-4 rounded-2xl border border-brand/40 bg-card p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-fg-faint">
            Números seleccionados
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...selected.entries()].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => toggle(value, label)}
                aria-label={`Quitar número ${label}`}
                className="group inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-brand px-3 font-display text-sm font-bold tracking-wider text-white"
              >
                {label}
                <IconX width={13} height={13} className="opacity-70 group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Barra de resumen */}
      <div
        className={`fixed inset-x-0 bottom-16 z-30 transition-transform duration-300 lg:bottom-0 ${
          canContinue ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="mx-auto w-full max-w-3xl px-4 pb-3">
          <div className="neon-card flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-fg-faint">
                {quantity} {quantity === 1 ? "número" : "números"}
              </p>
              <p className="font-display text-xl font-black tabular-nums text-fg">
                {formatCop(total)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setFormError("");
                setCheckoutOpen(true);
              }}
              className="glow-red-sm inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold uppercase tracking-wide text-white transition-all hover:bg-brand-dark active:scale-[0.98]"
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
          aria-label="Completa tus datos"
          onClick={() => setCheckoutOpen(false)}
        >
          <div
            ref={panelRef}
            tabIndex={-1}
            className="neon-card modal-in max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-6 outline-none sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">
                  Paso 2 de 3 · Tus datos
                </p>
                <h3 className="mt-1 font-display text-lg font-extrabold uppercase text-fg">
                  {raffle.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutOpen(false)}
                aria-label="Cerrar"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-well text-fg-soft hover:text-fg"
              >
                <IconX width={18} height={18} />
              </button>
            </div>

            <div className="mt-3 rounded-xl bg-well px-4 py-3 text-sm">
              <div className="flex justify-between">
                <span className="text-fg-soft">
                  {quantity} {quantity === 1 ? "número" : "números"}
                  {tab === "azar" ? " al azar" : ""}
                </span>
                <span className="font-display font-black tabular-nums text-fg">
                  {formatCop(total)}
                </span>
              </div>
              {tab === "elegir" ? (
                <p className="mt-1 truncate text-xs text-fg-faint">
                  {[...selected.values()].join(" · ")}
                </p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-3.5">
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

              <button
                type="button"
                onClick={submitOrder}
                disabled={submitting}
                className="glow-red mt-1 inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-all hover:bg-brand-dark disabled:opacity-60"
              >
                {submitting ? (
                  "Reservando…"
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
