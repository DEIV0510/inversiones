import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";
import { IconBanknote, IconGift, IconMoto } from "@/components/icons";

const PRIZES = [
  { icon: IconBanknote, title: "Dinero en efectivo" },
  { icon: IconMoto, title: "Motocicletas" },
  { icon: IconGift, title: "Próximos premios" },
];

export default function PrizesSection() {
  return (
    <section id="premios" className="relative overflow-hidden bg-bg2 py-10 lg:py-16">
      <div className="dot-grid absolute inset-0" aria-hidden="true" />
      <div className="relative mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading kicker="Premios" title="Grandes premios" />
        </Reveal>
        <Reveal delay={1}>
          <div className="mx-auto mt-5 grid max-w-3xl grid-cols-3 gap-2.5 sm:gap-4">
            {PRIZES.map((prize) => (
              <div
                key={prize.title}
                className="flex flex-col items-center gap-2.5 rounded-2xl border border-line bg-card px-2 py-4 text-center transition-colors hover:border-brand/60 sm:py-5"
              >
                <span className="glow-brand-sm flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white">
                  <prize.icon width={22} height={22} />
                </span>
                <p className="font-display text-[11px] font-extrabold uppercase leading-tight text-fg sm:text-sm">
                  {prize.title}
                </p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-4 max-w-md text-center text-xs leading-relaxed text-fg-soft sm:text-sm">
            Premios que se entregan directamente a cada ganador. Muy pronto
            anunciaremos nuevos premios aquí y en nuestras redes.
          </p>
        </Reveal>
      </div>
    </section>
  );
}
