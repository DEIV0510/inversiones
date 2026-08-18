import Image from "next/image";
import Link from "next/link";
import type { PublicRaffle } from "@/lib/public";
import { formatCop } from "@/lib/format";
import { waConsult, waGeneral } from "@/lib/whatsapp";
import { statusMetaV2 } from "@/lib/raffle-status";
import ProgressBar from "./ProgressBar";
import Reveal from "./Reveal";
import {
  IconArrowRight,
  IconCalendar,
  IconGift,
  IconMapPin,
  IconTicket,
  IconWhatsApp,
} from "@/components/icons";

type Props = {
  whatsappNumber: string;
  location: string;
  featured: PublicRaffle | null;
};

/**
 * Marco de la foto del sorteo destacado según el formato elegido para la rifa.
 *
 * Las clases van escritas ENTERAS: Tailwind arma el CSS leyendo el código y
 * un nombre juntado con texto (`aspect-[${x}]`) no llegaría a la hoja de
 * estilos.
 *
 * `caja` limita el ancho para que un flyer vertical no estire la apertura:
 * a 320 px de ancho, un 9/16 mide unos 570 px de alto, que es lo que cabe al
 * lado del texto sin empujar el botón fuera de la pantalla. `sizes` le dice al
 * navegador qué ancho va a ocupar de verdad para que no pida una foto enorme.
 */
const FORMATOS_FOTO: Record<
  string,
  { marco: string; caja: string; sizes: string }
> = {
  "4/3": {
    marco: "aspect-[4/3]",
    caja: "",
    sizes: "(min-width: 1024px) 520px, 100vw",
  },
  "1/1": {
    marco: "aspect-square",
    caja: "mx-auto w-full max-w-[28rem]",
    sizes: "(min-width: 640px) 448px, 100vw",
  },
  "9/16": {
    marco: "aspect-[9/16]",
    caja: "mx-auto w-full max-w-[20rem]",
    sizes: "(min-width: 640px) 320px, 100vw",
  },
};

/**
 * Apertura tipo app: la página comienza mostrando directamente el sorteo
 * destacado con su CTA hacia la selección de números.
 */
export default function Hero({ whatsappNumber, location, featured }: Props) {
  // Formato desconocido (rifa antigua o dato raro) → el horizontal de siempre.
  const foto =
    (featured ? FORMATOS_FOTO[featured.imageAspect] : null) ?? FORMATOS_FOTO["4/3"];

  return (
    <section id="inicio" className="relative overflow-hidden">
      <div className="dot-grid absolute inset-0" aria-hidden="true" />
      <div
        className="absolute -top-44 left-1/2 h-[480px] w-[780px] -translate-x-1/2 rounded-full bg-brand/20 blur-[150px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-10 pt-20 sm:px-6 lg:px-8 lg:pb-14 lg:pt-28">
        {featured ? (
          <div className="grid gap-5 lg:grid-cols-2 lg:items-center lg:gap-12">
            <Reveal>
              <Link
                href={`/sorteo/${featured.slug}`}
                className={`neon-card relative block overflow-hidden rounded-3xl bg-card ${foto.marco} ${foto.caja}`}
                aria-label={`Ver el sorteo ${featured.title}`}
              >
                {featured.imageUrl ? (
                  // La foto se ve ENTERA (object-contain): si es un flyer, ahí
                  // van los premios anticipados y la fecha, y recortarlo sería
                  // esconder justo lo que vende. Detrás va la misma foto
                  // ampliada y desenfocada para tapar las franjas cuando las
                  // proporciones no calzan al milímetro; es el mismo archivo y
                  // el mismo `sizes`, así que el navegador lo descarga una
                  // sola vez.
                  // Es la primera imagen que se ve, así que carga con
                  // prioridad. En el móvil ocupa el ancho de la pantalla y en
                  // escritorio el ancho que declara el formato, que es lo que
                  // dice `sizes` para que no pida una versión más grande de la
                  // necesaria.
                  // Los SVG de demostración pasan sin optimizar: ya son
                  // vectoriales y ligeros, y el optimizador los rechaza por
                  // seguridad (podrían llevar scripts dentro).
                  <>
                    <Image
                      src={featured.imageUrl}
                      alt=""
                      aria-hidden="true"
                      fill
                      sizes={foto.sizes}
                      priority
                      unoptimized={featured.imageUrl.toLowerCase().endsWith(".svg")}
                      className="scale-110 object-cover opacity-30 blur-2xl"
                    />
                    <Image
                      src={featured.imageUrl}
                      alt={`Imagen del sorteo destacado: ${featured.title}`}
                      fill
                      sizes={foto.sizes}
                      priority
                      unoptimized={featured.imageUrl.toLowerCase().endsWith(".svg")}
                      className="object-contain"
                    />
                  </>
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-fg-faint">
                    <IconGift width={72} height={72} strokeWidth={1.25} />
                  </span>
                )}
                <span
                  className={`absolute left-4 top-4 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${statusMetaV2(featured.status).badgeClass}`}
                >
                  {statusMetaV2(featured.status).label}
                </span>
              </Link>
            </Reveal>

            <div>
              <Reveal>
                <p className="inline-flex items-center gap-2 rounded-full border border-line bg-well/60 px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-fg-soft">
                  <IconMapPin width={12} height={12} className="text-brand" />
                  {location} · Sorteo destacado
                </p>
              </Reveal>
              <Reveal delay={1}>
                <h1 className="mt-3 font-display text-3xl font-black uppercase leading-[1.06] tracking-tight text-fg sm:text-4xl lg:text-5xl">
                  {featured.title}
                </h1>
              </Reveal>
              {featured.description ? (
                <Reveal delay={2}>
                  <p className="mt-2.5 max-w-xl text-sm leading-relaxed text-fg-soft sm:text-base">
                    {featured.description}
                  </p>
                </Reveal>
              ) : null}

              <Reveal delay={2}>
                <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                      <IconGift width={16} height={16} className="text-brand" />
                      Premio
                    </span>
                    <span className="text-right font-display text-sm font-extrabold text-fg">
                      {featured.prize}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                      <IconTicket width={16} height={16} className="text-brand" />
                      Precio por número
                    </span>
                    <span className="text-right font-display text-sm font-extrabold tabular-nums text-fg">
                      {formatCop(featured.pricePerNumber)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                      <IconCalendar width={16} height={16} className="text-brand" />
                      Fecha
                    </span>
                    <span className="text-right font-display text-sm font-extrabold text-fg">
                      {featured.drawDateText?.trim() || "Por anunciar"}
                    </span>
                  </div>
                </div>
              </Reveal>

              <Reveal delay={3}>
                <ProgressBar pct={featured.progressPct} className="mt-4" />
                <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
                  {featured.status === "ACTIVE" ? (
                    <Link
                      href={`/sorteo/${featured.slug}`}
                      className="glow-brand inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand px-8 text-base font-bold uppercase tracking-wide text-white transition-all hover:bg-brand-dark active:scale-[0.98]"
                    >
                      Quiero participar
                      <IconArrowRight width={19} height={19} />
                    </Link>
                  ) : featured.status === "COMING_SOON" ? (
                    <a
                      href={waConsult(whatsappNumber, featured.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glow-brand inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand px-8 text-base font-bold uppercase tracking-wide text-white transition-all hover:bg-brand-dark active:scale-[0.98]"
                    >
                      <IconWhatsApp width={20} height={20} />
                      Consultar sorteo
                    </a>
                  ) : (
                    <a
                      href={waGeneral(whatsappNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glow-brand inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand px-8 text-base font-bold uppercase tracking-wide text-white transition-all hover:bg-brand-dark active:scale-[0.98]"
                    >
                      <IconWhatsApp width={20} height={20} />
                      Hablar por WhatsApp
                    </a>
                  )}
                  <Link
                    href="/#sorteos"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line-strong px-8 text-sm font-bold uppercase tracking-wide text-fg transition-colors hover:border-brand hover:text-brand sm:min-h-14"
                  >
                    Ver todos los sorteos
                  </Link>
                </div>
              </Reveal>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-well/60 px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-fg-soft">
                <IconMapPin width={12} height={12} className="text-brand" />
                {location}
              </p>
              <h1 className="mt-4 font-display text-3xl font-black uppercase leading-[1.05] text-fg sm:text-5xl">
                Sorteos de dinero y{" "}
                <span className="text-brand">motocicletas</span>
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-fg-soft sm:text-lg">
                Muy pronto abriremos un nuevo sorteo. Escríbenos por WhatsApp y
                te avisamos de primero.
              </p>
              <a
                href={waGeneral(whatsappNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className="glow-brand mt-6 inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand px-8 text-base font-bold uppercase tracking-wide text-white transition-all hover:bg-brand-dark"
              >
                <IconWhatsApp width={20} height={20} />
                Hablar por WhatsApp
              </a>
            </Reveal>
          </div>
        )}
      </div>
    </section>
  );
}
