import Reveal from "./Reveal";
import { waGeneral } from "@/lib/whatsapp";
import {
  IconMapPin,
  IconShieldCheck,
  IconTicket,
  IconTrophy,
  IconWhatsApp,
} from "@/components/icons";

type Props = {
  whatsappNumber: string;
  whatsappDisplay: string;
  location: string;
};

// Confianza y transparencia, condensadas en una sola sección.
const TRUST_ITEMS = [
  { icon: IconShieldCheck, title: "Información clara" },
  { icon: IconWhatsApp, title: "Atención directa" },
  { icon: IconTrophy, title: "Resultados publicados" },
  { icon: IconTicket, title: "Condiciones a la vista" },
];

export default function AboutSection({
  whatsappNumber,
  whatsappDisplay,
  location,
}: Props) {
  return (
    <section id="nosotros" className="py-10 lg:py-16">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12 lg:px-8">
        <Reveal>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-brand">
              Nosotros · Confianza
            </p>
            <h2 className="mt-1.5 font-display text-2xl font-extrabold uppercase leading-tight text-fg sm:text-3xl">
              ¿Qué es Inversiones D y S?
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-fg-soft sm:text-base">
              Una nueva forma de participar por grandes premios. Organizamos
              sorteos de dinero en efectivo y motocicletas desde {location},
              con información clara y atención directa por WhatsApp.
            </p>
            <div id="confianza" className="mt-4 grid grid-cols-2 gap-2.5">
              {TRUST_ITEMS.map((item) => (
                <div
                  key={item.title}
                  className="flex items-center gap-2.5 rounded-xl border border-line bg-card px-3 py-2.5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-well text-brand">
                    <item.icon width={16} height={16} />
                  </span>
                  <span className="text-xs font-bold leading-tight text-fg sm:text-sm">
                    {item.title}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={1}>
          <div className="rounded-3xl border border-line bg-card p-5 sm:p-6">
            <h3 className="font-display text-base font-extrabold uppercase text-fg">
              Habla directamente con nosotros
            </h3>
            <div className="mt-3.5 grid gap-2.5">
              <div className="flex items-center gap-3.5 rounded-2xl bg-well p-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-wa/15 text-wa">
                  <IconWhatsApp width={20} height={20} />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                    WhatsApp
                  </p>
                  <p className="font-display text-base font-extrabold tabular-nums text-fg">
                    {whatsappDisplay}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3.5 rounded-2xl bg-well p-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/15 text-brand">
                  <IconMapPin width={20} height={20} />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                    Ubicación
                  </p>
                  <p className="font-display text-base font-extrabold text-fg">
                    {location}
                  </p>
                </div>
              </div>
            </div>
            <a
              href={waGeneral(whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="glow-brand-sm mt-3.5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark"
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
