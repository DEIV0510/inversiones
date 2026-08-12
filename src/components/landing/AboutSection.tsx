import Reveal from "./Reveal";
import { waGeneral } from "@/lib/whatsapp";
import {
  IconCheck,
  IconMapPin,
  IconWhatsApp,
} from "@/components/icons";

type Props = {
  whatsappNumber: string;
  whatsappDisplay: string;
  location: string;
};

const BULLETS = [
  "Sorteos de dinero en efectivo y motocicletas",
  "Atención personal y directa por WhatsApp",
  "Porcentaje de avance visible en cada sorteo",
  "Nuevos premios que se irán anunciando",
];

export default function AboutSection({
  whatsappNumber,
  whatsappDisplay,
  location,
}: Props) {
  return (
    <section id="nosotros" className="py-16 lg:py-24">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <Reveal>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand">
              Nosotros
            </p>
            <h2 className="mt-3 font-display text-3xl font-extrabold uppercase leading-tight text-fg sm:text-4xl">
              ¿Qué es Inversiones D y S?
            </h2>
            <p className="mt-5 text-base leading-relaxed text-fg-soft sm:text-lg">
              Una nueva forma de participar por grandes premios. Organizamos
              sorteos de dinero en efectivo y motocicletas desde {location},
              con información clara y atención directa por WhatsApp.
            </p>
            <ul className="mt-7 grid gap-3">
              {BULLETS.map((bullet) => (
                <li key={bullet} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
                    <IconCheck width={14} height={14} strokeWidth={3} />
                  </span>
                  <span className="text-sm font-medium text-fg sm:text-base">
                    {bullet}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={1}>
          <div className="rounded-3xl border border-line bg-card p-7 sm:p-9">
            <h3 className="font-display text-lg font-extrabold uppercase text-fg">
              Habla directamente con nosotros
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-soft">
              Sin intermediarios: resolvemos tus dudas y gestionamos tu
              participación por WhatsApp.
            </p>
            <div className="mt-6 grid gap-3">
              <div className="flex items-center gap-4 rounded-2xl bg-well p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-wa/15 text-wa">
                  <IconWhatsApp width={22} height={22} />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                    WhatsApp
                  </p>
                  <p className="font-display text-lg font-extrabold tabular-nums text-fg">
                    {whatsappDisplay}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 rounded-2xl bg-well p-4">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
                  <IconMapPin width={22} height={22} />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                    Ubicación
                  </p>
                  <p className="font-display text-lg font-extrabold text-fg">
                    {location}
                  </p>
                </div>
              </div>
            </div>
            <a
              href={waGeneral(whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="glow-red-sm mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark"
            >
              <IconWhatsApp width={18} height={18} />
              Hablar por WhatsApp
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
