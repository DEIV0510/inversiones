import type { RaffleView } from "@/lib/types";
import { formatCop } from "@/lib/format";
import { waConsult } from "@/lib/whatsapp";
import { statusMeta } from "@/lib/raffle-status";
import ProgressBar from "./ProgressBar";
import ParticipateButton from "./ParticipateButton";
import {
  IconCalendar,
  IconGift,
  IconTicket,
} from "@/components/icons";

type Props = {
  raffle: RaffleView;
  whatsappNumber: string;
};

export default function RaffleCard({ raffle, whatsappNumber }: Props) {
  const meta = statusMeta(raffle.status);
  const isActive = raffle.status === "active";
  const isComing = raffle.status === "coming_soon";
  const isFinished = raffle.status === "finished";
  const isSoldOut = raffle.status === "sold_out";

  return (
    <article
      className={`group flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-card transition-shadow duration-300 ${
        isActive ? "neon-card" : "border border-line"
      }`}
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-bg2">
        {raffle.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={raffle.imageUrl}
            alt={`Imagen del sorteo: ${raffle.title}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-fg-faint">
            <IconGift width={56} height={56} strokeWidth={1.5} />
          </div>
        )}
        <span
          className={`absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${meta.badgeClass}`}
        >
          {meta.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div>
          <h3 className="font-display text-lg font-extrabold uppercase leading-snug text-fg">
            {raffle.title}
          </h3>
          {raffle.description ? (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-fg-soft">
              {raffle.description}
            </p>
          ) : null}
        </div>

        <dl className="grid gap-2 text-sm">
          <div className="flex items-center gap-2.5">
            <IconGift width={17} height={17} className="shrink-0 text-brand" />
            <dt className="sr-only">Premio</dt>
            <dd className="font-semibold text-fg">{raffle.prize}</dd>
          </div>
          <div className="flex items-center gap-2.5">
            <IconTicket width={17} height={17} className="shrink-0 text-brand" />
            <dt className="sr-only">Precio de participación</dt>
            <dd className="text-fg-soft">
              {raffle.priceCop != null ? (
                <>
                  <span className="font-bold tabular-nums text-fg">
                    {formatCop(raffle.priceCop)}
                  </span>{" "}
                  por participación
                </>
              ) : (
                "Precio por anunciar"
              )}
            </dd>
          </div>
          <div className="flex items-center gap-2.5">
            <IconCalendar width={17} height={17} className="shrink-0 text-brand" />
            <dt className="sr-only">Fecha del sorteo</dt>
            <dd className="text-fg-soft">
              {raffle.drawDateText?.trim() || "Fecha por anunciar"}
            </dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-col gap-4">
          <ProgressBar pct={raffle.progressPct} />

          {isActive ? (
            <ParticipateButton
              raffleTitle={raffle.title}
              priceCop={raffle.priceCop}
              whatsappNumber={whatsappNumber}
              className="w-full"
            />
          ) : isComing ? (
            <a
              href={waConsult(whatsappNumber, raffle.title)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line-strong px-5 text-sm font-bold uppercase tracking-wide text-fg transition-colors hover:border-brand hover:text-brand"
            >
              Consultar sorteo
            </a>
          ) : (
            <span
              className={`inline-flex min-h-12 items-center justify-center rounded-xl px-5 text-sm font-bold uppercase tracking-wide ${
                isSoldOut
                  ? "bg-brand-deep/40 text-brand"
                  : "bg-well text-fg-faint"
              }`}
            >
              {isFinished ? "Sorteo finalizado" : "Boletas agotadas"}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
