import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";
import {
  IconCalendar,
  IconCheck,
  IconTicket,
  IconWhatsApp,
} from "@/components/icons";

const STEPS = [
  {
    number: "01",
    icon: IconTicket,
    title: "Elige tu sorteo",
    text: "Conoce los sorteos disponibles, sus premios y su porcentaje de avance.",
  },
  {
    number: "02",
    icon: IconWhatsApp,
    title: "Contáctanos",
    text: "Escríbenos por WhatsApp con el botón del sorteo que te interesa.",
  },
  {
    number: "03",
    icon: IconCheck,
    title: "Realiza tu participación",
    text: "Sigue las instrucciones que te daremos directamente por WhatsApp.",
  },
  {
    number: "04",
    icon: IconCalendar,
    title: "Espera el sorteo",
    text: "Mantente atento a la fecha del sorteo y al anuncio de resultados.",
  },
];

export default function HowItWorks() {
  return (
    <section id="como-participar" className="bg-bg2 py-16 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            kicker="Cómo participar"
            title="Participar es muy fácil"
            intro="En cuatro pasos simples puedes estar participando por grandes premios."
          />
        </Reveal>
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <Reveal key={step.number} delay={(Math.min(i, 3) as 0 | 1 | 2 | 3)}>
              <li className="relative flex h-full flex-col gap-4 rounded-2xl border border-line bg-card p-6">
                <span
                  className="font-display text-4xl font-black tabular-nums text-brand/25"
                  aria-hidden="true"
                >
                  {step.number}
                </span>
                <span className="absolute right-5 top-5 flex h-10 w-10 items-center justify-center rounded-xl bg-well text-brand">
                  <step.icon width={20} height={20} />
                </span>
                <div>
                  <h3 className="font-display text-base font-extrabold uppercase text-fg">
                    {step.title}
                  </h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-soft">
                    {step.text}
                  </p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
