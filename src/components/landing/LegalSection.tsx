import Link from "next/link";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";
import { IconArrowRight, IconShieldCheck, IconTicket } from "@/components/icons";

const CARDS = [
  {
    icon: IconTicket,
    title: "Términos y condiciones",
    text: "Las condiciones generales de participación en nuestros sorteos.",
    href: "/terminos",
  },
  {
    icon: IconShieldCheck,
    title: "Tratamiento de datos",
    text: "Cómo protegemos y usamos tus datos personales.",
    href: "/privacidad",
  },
];

export default function LegalSection() {
  return (
    <section id="condiciones" className="bg-bg2 py-16 lg:py-20">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            kicker="Condiciones"
            title="Participa informado"
            intro="Antes de participar puedes consultar las condiciones generales. Además, el detalle de cada sorteo se comparte directamente por WhatsApp."
          />
        </Reveal>
        <div className="mx-auto mt-10 grid max-w-3xl gap-5 sm:grid-cols-2">
          {CARDS.map((card, i) => (
            <Reveal key={card.href} delay={(i as 0 | 1)}>
              <Link
                href={card.href}
                className="group flex h-full flex-col gap-4 rounded-2xl border border-line bg-card p-6 transition-colors hover:border-brand/60"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-well text-brand">
                  <card.icon width={24} height={24} />
                </span>
                <div>
                  <h3 className="font-display text-base font-extrabold uppercase text-fg">
                    {card.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-soft">
                    {card.text}
                  </p>
                </div>
                <span className="mt-auto inline-flex items-center gap-1.5 text-sm font-bold text-brand">
                  Leer más
                  <IconArrowRight
                    width={16}
                    height={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
