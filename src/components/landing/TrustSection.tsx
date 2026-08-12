import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";
import { waGeneral } from "@/lib/whatsapp";
import {
  IconShieldCheck,
  IconTicket,
  IconTrophy,
  IconWhatsApp,
} from "@/components/icons";

type Props = {
  whatsappNumber: string;
};

const ITEMS = [
  {
    icon: IconShieldCheck,
    title: "Información clara",
    text: "Cada sorteo publica su premio, precio, fecha y porcentaje de avance, sin letra menuda.",
  },
  {
    icon: IconWhatsApp,
    title: "Atención directa",
    text: "Hablas directamente con Inversiones D y S por WhatsApp, antes y después de participar.",
  },
  {
    icon: IconTrophy,
    title: "Resultados publicados",
    text: "Los ganadores de cada sorteo se anuncian y quedan publicados en esta página.",
  },
  {
    icon: IconTicket,
    title: "Condiciones a la vista",
    text: "Los términos y condiciones están disponibles aquí y te los compartimos por WhatsApp.",
  },
];

export default function TrustSection({ whatsappNumber }: Props) {
  return (
    <section id="confianza" className="py-16 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            kicker="Confianza"
            title="Transparencia en cada sorteo"
            intro="Queremos que participes con total tranquilidad. Así trabajamos:"
          />
        </Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((item, i) => (
            <Reveal key={item.title} delay={(Math.min(i, 3) as 0 | 1 | 2 | 3)}>
              <div className="flex h-full flex-col gap-4 rounded-2xl border border-line bg-card p-6 transition-colors hover:border-brand/50">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-well text-brand">
                  <item.icon width={24} height={24} />
                </span>
                <div>
                  <h3 className="font-display text-base font-extrabold uppercase text-fg">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-soft">
                    {item.text}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-8">
          <div className="neon-card flex flex-col items-center justify-between gap-5 rounded-2xl bg-card px-7 py-8 sm:flex-row sm:px-9">
            <div>
              <h3 className="font-display text-xl font-extrabold uppercase text-fg">
                ¿Tienes dudas?
              </h3>
              <p className="mt-1 text-sm text-fg-soft">
                Escríbenos y te respondemos personalmente por WhatsApp.
              </p>
            </div>
            <a
              href={waGeneral(whatsappNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="glow-red-sm inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark"
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
