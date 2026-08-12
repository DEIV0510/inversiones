import type { RaffleView } from "@/lib/types";
import { waGeneral } from "@/lib/whatsapp";
import RaffleCard from "./RaffleCard";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";
import { IconTicket, IconWhatsApp } from "@/components/icons";

type Props = {
  raffles: RaffleView[];
  whatsappNumber: string;
};

export default function RafflesSection({ raffles, whatsappNumber }: Props) {
  return (
    <section id="sorteos" className="relative py-16 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            kicker="Sorteos"
            title="Sorteos disponibles"
            intro="Cada sorteo muestra su premio, precio de participación, fecha y porcentaje de avance. Elige el tuyo y participa por WhatsApp."
          />
        </Reveal>

        {raffles.length > 0 ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {raffles.map((raffle, i) => (
              <Reveal key={raffle.id} delay={(Math.min(i, 2) as 0 | 1 | 2)}>
                <RaffleCard raffle={raffle} whatsappNumber={whatsappNumber} />
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal className="mt-10">
            <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-line bg-card px-6 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
                <IconTicket width={28} height={28} />
              </span>
              <h3 className="font-display text-xl font-extrabold uppercase text-fg">
                Muy pronto nuevos sorteos
              </h3>
              <p className="text-sm leading-relaxed text-fg-soft">
                Por el momento no hay sorteos publicados. Escríbenos por WhatsApp
                y te avisaremos cuando abra el próximo.
              </p>
              <a
                href={waGeneral(whatsappNumber)}
                target="_blank"
                rel="noopener noreferrer"
                className="glow-red-sm inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark"
              >
                <IconWhatsApp width={18} height={18} />
                Hablar por WhatsApp
              </a>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
