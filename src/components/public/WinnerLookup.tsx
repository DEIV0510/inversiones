"use client";

import { useState } from "react";
import {
  IconChevronDown,
  IconGift,
  IconTicket,
  IconTrophy,
} from "@/components/icons";

/* Campo tipo "pozo": fondo well, borde tenue y foco fucsia con halo. */
const inputCls =
  "min-h-13 w-full rounded-2xl border border-line bg-well px-4 text-base text-fg transition-colors placeholder:text-fg-faint/70 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/35";

/** Datos mínimos de cada sorteo consultable. Nada de inventario. */
export type RifaConsultable = {
  slug: string;
  title: string;
  digits: number;
  totalNumbers: number;
};

type Dueno = { nombre: string; telefono: string };

type Resultado = {
  raffle: { slug: string; title: string; drawDateText: string | null };
  number: string;
  dueno: Dueno | null;
  premio: string | null;
};

type Props = {
  rifas: RifaConsultable[];
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

export default function WinnerLookup({ rifas }: Props) {
  const [slug, setSlug] = useState(rifas[0]?.slug ?? "");
  const [numero, setNumero] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<Resultado | null>(null);

  const rifa = rifas.find((r) => r.slug === slug) ?? rifas[0];

  if (!rifa) {
    return (
      <div className="mt-6 rounded-3xl border border-line bg-card p-6 text-center">
        <p className="text-sm leading-relaxed text-fg-soft">
          Todavía no hay sorteos publicados para consultar. Vuelve cuando se
          anuncie el próximo.
        </p>
      </div>
    );
  }

  const minimo = "0".repeat(rifa.digits);
  const maximo = String(rifa.totalNumbers - 1).padStart(rifa.digits, "0");

  /** Cambiar de sorteo invalida lo consultado antes: se limpia todo. */
  function onCambiarRifa(nuevo: string) {
    setSlug(nuevo);
    setNumero("");
    setError("");
    setResultado(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResultado(null);
    try {
      const res = await fetch(
        `/api/public/winner?slug=${encodeURIComponent(slug)}&n=${encodeURIComponent(numero)}`
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible consultar");
        return;
      }
      setResultado(data);
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
        <TituloSeccion>Número ganador</TituloSeccion>

        {/* El selector solo aparece cuando de verdad hay dónde elegir. */}
        {rifas.length > 1 ? (
          <div>
            <label
              htmlFor="gn-rifa"
              className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-fg-faint"
            >
              Sorteo
            </label>
            <div className="relative">
              <select
                id="gn-rifa"
                value={slug}
                onChange={(e) => onCambiarRifa(e.target.value)}
                className={`${inputCls} appearance-none pr-11`}
              >
                {rifas.map((r) => (
                  /* La lista desplegable la pinta el sistema: se le fija el
                     color para que no salga en blanco sobre el tema oscuro. */
                  <option key={r.slug} value={r.slug} className="bg-card text-fg">
                    {r.title}
                  </option>
                ))}
              </select>
              <IconChevronDown
                width={18}
                height={18}
                aria-hidden="true"
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-fg-faint"
              />
            </div>
          </div>
        ) : null}

        <div>
          <label
            htmlFor="gn-numero"
            className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.14em] text-fg-faint"
          >
            Número que salió
          </label>
          <input
            id="gn-numero"
            type="text"
            inputMode="numeric"
            required
            value={numero}
            onChange={(e) =>
              setNumero(e.target.value.replace(/\D/g, "").slice(0, rifa.digits))
            }
            className={`${inputCls} text-center font-display text-2xl font-black tracking-[0.28em] text-brand-light`}
            placeholder={minimo}
            maxLength={rifa.digits}
            autoComplete="off"
          />
          <p className="mt-1.5 text-xs leading-relaxed text-fg-faint">
            Escribe el número tal como salió en la lotería (de {minimo} a{" "}
            {maximo}).
          </p>
        </div>

        {error ? (
          <p role="alert" className="text-sm font-semibold text-error">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={loading || numero === ""}
          className="glow-brand inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl bg-brand px-5 font-display text-sm font-black uppercase tracking-[0.12em] text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          <IconTrophy width={18} height={18} />
          {loading ? "Consultando…" : "Ver quién ganó"}
        </button>
      </form>

      {/* Región viva siempre presente: si naciera junto al resultado, el
          lector de pantalla no llegaría a anunciarlo. */}
      <div aria-live="polite" className="flex flex-col gap-3">
        {resultado ? (
          <>
            <TituloSeccion>Resultado</TituloSeccion>

            {resultado.dueno ? (
              <div className="neon-card rounded-3xl bg-card p-5 text-center sm:p-6">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand">
                  ¡Felicitaciones!
                </p>
                <p className="mt-3 text-xs uppercase tracking-[0.14em] text-fg-faint">
                  Número
                </p>
                {/* La ficha se ajusta sola en pantallas de 360px. */}
                <p className="ticket-chip mx-auto mt-2 inline-block max-w-full break-all rounded-xl px-4 py-2 font-display text-2xl font-black tracking-[0.18em] text-white sm:text-3xl">
                  {resultado.number}
                </p>
                <p className="mt-5 text-xs uppercase tracking-[0.14em] text-fg-faint">
                  Ganador
                </p>
                <p className="mt-1 break-words font-display text-xl font-black uppercase leading-tight text-fg sm:text-2xl">
                  {resultado.dueno.nombre}
                </p>
                <p className="mt-1 font-display text-base font-bold tabular-nums tracking-wider text-fg-soft">
                  {resultado.dueno.telefono}
                </p>
                {resultado.premio ? (
                  <p className="mt-4 inline-flex max-w-full items-center gap-2 rounded-full bg-well px-3.5 py-2 text-sm font-bold text-brand-light">
                    <IconGift width={16} height={16} className="shrink-0" />
                    <span className="break-words">{resultado.premio}</span>
                  </p>
                ) : null}
                <p className="mt-5 text-xs leading-relaxed text-fg-faint">
                  Por seguridad los datos se muestran abreviados. Al ganador se
                  le contacta directamente para la entrega del premio.
                </p>
              </div>
            ) : (
              <div className="rounded-3xl border border-line bg-card p-5 text-center sm:p-6">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-well text-fg-faint">
                  <IconTicket width={22} height={22} />
                </span>
                <p className="mt-3 font-display text-lg font-black uppercase leading-tight text-fg">
                  {resultado.number}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-fg-soft">
                  Este número todavía no tiene dueño en{" "}
                  <strong className="text-fg">{resultado.raffle.title}</strong>.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-fg-faint">
                  Revisa que sea el número correcto y que hayas elegido el
                  sorteo indicado.
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
