import type { RaffleView } from "@/lib/types";
import { formatCop } from "@/lib/format";
import { waConsult, waGeneral } from "@/lib/whatsapp";
import { statusMeta } from "@/lib/raffle-status";
import ProgressBar from "./ProgressBar";
import ParticipateButton from "./ParticipateButton";
import Reveal from "./Reveal";
import {
  IconCalendar,
  IconGift,
  IconMapPin,
  IconTicket,
  IconWhatsApp,
} from "@/components/icons";

type Props = {
  whatsappNumber: string;
  location: string;
  featured: RaffleView | null;
};

/**
 * Apertura tipo app: la página comienza mostrando directamente el sorteo
 * destacado, como una plataforma de rifas moderna.
 */
export default function Hero({ whatsappNumber, location, featured }: Props) {
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
              <div className="neon-card relative overflow-hidden rounded-3xl bg-card">
                {featured.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={featured.imageUrl}
                    alt={`Imagen del sorteo destacado: ${featured.title}`}
                    className="aspect-[4/3] w-full object-cover"
                    decoding="async"
                  />
                ) : (
                  <div className="flex aspect-[4/3] w-full items-center justify-center text-fg-faint">
                    <IconGift width={72} height={72} strokeWidth={1.25} />
                  </div>
                )}
                <span
                  className={`absolute left-4 top-4 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${statusMeta(featured.status).badgeClass}`}
                >
                  {statusMeta(featured.status).label}
                </span>
              </div>
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
                      Precio
                    </span>
                    <span className="text-right font-display text-sm font-extrabold tabular-nums text-fg">
                      {featured.priceCop != null
                        ? formatCop(featured.priceCop)
                        : "Por anunciar"}
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
                  {featured.status === "active" ? (
                    <ParticipateButton
                      raffleTitle={featured.title}
                      priceCop={featured.priceCop}
                      whatsappNumber={whatsappNumber}
                      size="big"
                      className="w-full sm:w-auto"
                    />
                  ) : featured.status === "coming_soon" ? (
                    <a
                      href={waConsult(whatsappNumber, featured.title)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glow-red inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand px-8 text-base font-bold uppercase tracking-wide text-white transition-all hover:bg-brand-dark active:scale-[0.98]"
                    >
                      <IconWhatsApp width={20} height={20} />
                      Consultar sorteo
                    </a>
                  ) : (
                    // Agotado o finalizado: CTA honesto, sin invitar a
                    // participar en un sorteo que ya no admite boletas.
                    <a
                      href={waGeneral(whatsappNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="glow-red inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand px-8 text-base font-bold uppercase tracking-wide text-white transition-all hover:bg-brand-dark active:scale-[0.98]"
                    >
                      <IconWhatsApp width={20} height={20} />
                      Hablar por WhatsApp
                    </a>
                  )}
                  <a
                    href="/#sorteos"
                    className="inline-flex min-h-12 items-center justify-center rounded-xl border border-line-strong px-8 text-sm font-bold uppercase tracking-wide text-fg transition-colors hover:border-brand hover:text-brand sm:min-h-14"
                  >
                    Ver todos los sorteos
                  </a>
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
                className="glow-red mt-6 inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-brand px-8 text-base font-bold uppercase tracking-wide text-white transition-all hover:bg-brand-dark"
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
