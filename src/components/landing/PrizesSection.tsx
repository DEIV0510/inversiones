import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";
import { IconBanknote, IconGift, IconMoto } from "@/components/icons";

const PRIZES = [
  {
    icon: IconBanknote,
    title: "Dinero en efectivo",
    text: "Premios en efectivo que se entregan directamente a la persona ganadora de cada sorteo.",
  },
  {
    icon: IconMoto,
    title: "Motocicletas",
    text: "Motos 0 KM para estrenar: uno de los premios más esperados de nuestros sorteos.",
  },
  {
    icon: IconGift,
    title: "Próximos premios",
    text: "Seguiremos incorporando nuevos premios. Los anunciaremos aquí y en nuestras redes.",
  },
];

export default function PrizesSection() {
  return (
    <section id="premios" className="relative overflow-hidden bg-bg2 py-16 lg:py-24">
      <div className="dot-grid absolute inset-0" aria-hidden="true" />
      <div
        className="absolute -bottom-48 left-1/2 h-[380px] w-[680px] -translate-x-1/2 rounded-full bg-brand/15 blur-[130px]"
        aria-hidden="true"
      />
      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            kicker="Premios"
            title="Grandes premios"
            intro="Esto es lo que puedes ganar participando en los sorteos de Inversiones D y S."
          />
        </Reveal>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {PRIZES.map((prize, i) => (
            <Reveal key={prize.title} delay={(i as 0 | 1 | 2)}>
              <div className="flex h-full flex-col gap-5 rounded-2xl border border-line bg-card p-7 transition-colors hover:border-brand/60">
                <span className="glow-red-sm flex h-13 w-13 items-center justify-center rounded-2xl bg-brand text-white">
                  <prize.icon width={26} height={26} />
                </span>
                <div>
                  <h3 className="font-display text-xl font-extrabold uppercase text-fg">
                    {prize.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-fg-soft">
                    {prize.text}
                  </p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
