import type { WinnerView } from "@/lib/types";
import Reveal from "./Reveal";
import SectionHeading from "./SectionHeading";
import { IconTrophy } from "@/components/icons";

type Props = {
  winners: WinnerView[];
};

export default function WinnersSection({ winners }: Props) {
  return (
    <section id="ganadores" className="bg-bg2 py-16 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <SectionHeading
            kicker="Ganadores"
            title="Nuestros ganadores"
            intro="Cada vez que se realice un sorteo, publicaremos aquí a la persona ganadora, su premio y la fecha."
          />
        </Reveal>

        {winners.length > 0 ? (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {winners.map((winner, i) => (
              <Reveal key={winner.id} delay={(Math.min(i, 2) as 0 | 1 | 2)}>
                <article className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-card">
                  {winner.isDemo ? (
                    <span className="absolute right-3 top-3 z-10 rounded-full bg-well px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-fg-soft">
                      Demo
                    </span>
                  ) : null}
                  {winner.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={winner.photoUrl}
                      alt={`Ganador: ${winner.name}`}
                      loading="lazy"
                      decoding="async"
                      className="aspect-[4/3] w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-[4/3] w-full items-center justify-center bg-bg2 text-fg-faint">
                      <IconTrophy width={52} height={52} strokeWidth={1.5} />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-1.5 p-5">
                    <h3 className="font-display text-lg font-extrabold text-fg">
                      {winner.name}
                    </h3>
                    <p className="text-sm font-semibold text-brand">{winner.prize}</p>
                    {winner.raffleTitle ? (
                      <p className="text-sm text-fg-soft">{winner.raffleTitle}</p>
                    ) : null}
                    {winner.drawnAtText ? (
                      <p className="mt-auto pt-2 text-xs font-semibold uppercase tracking-wide text-fg-faint">
                        {winner.drawnAtText}
                      </p>
                    ) : null}
                  </div>
                </article>
              </Reveal>
            ))}
          </div>
        ) : (
          <Reveal className="mt-10">
            <div className="mx-auto flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-line bg-card px-6 py-12 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/15 text-brand">
                <IconTrophy width={28} height={28} />
              </span>
              <h3 className="font-display text-xl font-extrabold uppercase text-fg">
                Los ganadores aparecerán aquí
              </h3>
              <p className="text-sm leading-relaxed text-fg-soft">
                Cuando se realice cada sorteo, publicaremos en esta sección a la
                persona ganadora con su premio y la fecha del sorteo.
              </p>
            </div>
          </Reveal>
        )}
      </div>
    </section>
  );
}
