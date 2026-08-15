import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import BottomBar from "@/components/landing/BottomBar";
import ProgressBar from "@/components/landing/ProgressBar";
import NumberPicker from "@/components/public/NumberPicker";
import { formatCop } from "@/lib/format";
import { getPrizedGroups, getPublicRaffleBySlug } from "@/lib/public";
import { getSettings } from "@/lib/settings";
import { statusMetaV2 } from "@/lib/raffle-status";
import { waConsult } from "@/lib/whatsapp";
import {
  IconCalendar,
  IconGift,
  IconTicket,
  IconTrophy,
  IconWhatsApp,
} from "@/components/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const raffle = await getPublicRaffleBySlug(slug);
  if (!raffle) return { title: "Sorteo no encontrado" };
  return {
    title: raffle.title,
    description: `Participa por ${raffle.prize}. ${raffle.progressPct}% alcanzado.`,
    openGraph: raffle.imageUrl
      ? { images: [{ url: raffle.imageUrl }] }
      : undefined,
  };
}

export default async function SorteoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [raffle, settings] = await Promise.all([
    getPublicRaffleBySlug(slug),
    getSettings(),
  ]);
  if (!raffle) notFound();

  const meta = statusMetaV2(raffle.status);
  // Números premiados publicados, agrupados por premio.
  const prizedGroups = await getPrizedGroups(raffle.id, raffle.digits);

  return (
    <>
      <Header
        whatsappNumber={settings.whatsapp_number}
        companyName={settings.company_name}
        hideWhatsApp={!raffle.whatsappCheckout}
      />
      <main className="relative mx-auto w-full max-w-3xl px-4 pb-40 pt-20 sm:px-6 lg:pt-28">
        <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative">
          {/* Imagen + estado */}
          <div className="neon-card relative overflow-hidden rounded-3xl bg-card">
            {raffle.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={raffle.imageUrl}
                alt={`Imagen del sorteo: ${raffle.title}`}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center text-fg-faint">
                <IconGift width={72} height={72} strokeWidth={1.25} />
              </div>
            )}
            <span
              className={`absolute left-4 top-4 rounded-full px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.14em] ${meta.badgeClass}`}
            >
              {meta.label}
            </span>
          </div>

          {raffle.gallery.length > 0 ? (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {raffle.gallery.slice(0, 4).map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full rounded-xl border border-line object-cover"
                />
              ))}
            </div>
          ) : null}

          <h1 className="mt-5 font-display text-3xl font-black uppercase leading-[1.06] text-fg sm:text-4xl">
            {raffle.title}
          </h1>
          {raffle.description ? (
            <p className="mt-2.5 text-sm leading-relaxed text-fg-soft sm:text-base">
              {raffle.description}
            </p>
          ) : null}

          {/* Info */}
          <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                <IconGift width={16} height={16} className="text-brand" />
                Premio
              </span>
              <span className="text-right font-display text-sm font-extrabold text-fg">
                {raffle.prize}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                <IconTicket width={16} height={16} className="text-brand" />
                Precio por número
              </span>
              <span className="text-right font-display text-sm font-extrabold tabular-nums text-fg">
                {formatCop(raffle.pricePerNumber)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                <IconCalendar width={16} height={16} className="text-brand" />
                Fecha
              </span>
              <span className="text-right font-display text-sm font-extrabold text-fg">
                {raffle.drawDateText?.trim() || "Por anunciar"}
              </span>
            </div>
          </div>

          {/* Lista de premios configurada para este sorteo */}
          {raffle.prizes.length > 0 ? (
            <section className="mt-5" aria-labelledby="premios-sorteo">
              <h2
                id="premios-sorteo"
                className="text-[11px] font-bold uppercase tracking-[0.16em] text-fg-faint"
              >
                Premios de este sorteo
              </h2>
              <div className="mt-2.5 flex flex-col gap-2.5">
                {raffle.prizes.map((prize, i) => {
                  const Icon = i === 0 ? IconTrophy : IconGift;
                  return (
                    <div
                      key={`${i}-${prize.title}`}
                      className={`flex items-start gap-3 rounded-2xl bg-card p-4 ${
                        i === 0 ? "neon-card" : "border border-line"
                      }`}
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                          i === 0
                            ? "bg-brand/15 text-brand"
                            : "bg-well text-fg-soft"
                        }`}
                      >
                        <Icon width={20} height={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        {prize.label ? (
                          <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.16em] text-fg-faint">
                            {prize.label}
                          </p>
                        ) : null}
                        {prize.amount ? (
                          <p className="mt-1 break-words font-display text-2xl font-black leading-none tabular-nums text-fg sm:text-3xl">
                            {prize.amount}
                          </p>
                        ) : null}
                        <p className="mt-1 break-words text-sm font-semibold leading-snug text-fg">
                          {prize.title}
                        </p>
                        {prize.note ? (
                          <p className="mt-1 break-words text-xs leading-relaxed text-fg-soft">
                            {prize.note}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <ProgressBar pct={raffle.progressPct} className="mt-4" />

          {/* Números premiados: se publican para que la gente los busque. */}
          {prizedGroups.length > 0 ? (
            <section className="mt-6 flex flex-col gap-4">
              {prizedGroups.map((grupo) => (
                <div
                  key={grupo.prize}
                  className="rounded-2xl border border-line bg-card p-4"
                >
                  <h2 className="text-center font-display text-base font-black uppercase leading-tight text-fg sm:text-lg">
                    {grupo.numbers.length}{" "}
                    {grupo.numbers.length === 1 ? "número premiado" : "números premiados"}{" "}
                    con {grupo.prize}
                  </h2>
                  <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                    {grupo.numbers.map((n) => (
                      <span
                        key={n}
                        className="rounded-md bg-well px-2.5 py-1.5 font-display text-sm font-bold tracking-wider text-brand ring-1 ring-brand/30"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2.5 text-center text-xs text-fg-soft">
                    Si compras uno de estos números, el premio es tuyo al
                    instante.
                  </p>
                </div>
              ))}
            </section>
          ) : null}

          {/* Selección de números */}
          {raffle.status === "ACTIVE" ? (
            <NumberPicker raffle={raffle} />
          ) : (
            <div className="mt-6 rounded-2xl border border-line bg-card p-6 text-center">
              <p className="font-display text-lg font-extrabold uppercase text-fg">
                {raffle.status === "COMING_SOON"
                  ? "Este sorteo abre muy pronto"
                  : raffle.status === "SOLD_OUT"
                    ? "Boletas agotadas"
                    : "Sorteo finalizado"}
              </p>
              {raffle.whatsappCheckout ? (
                <a
                  href={waConsult(settings.whatsapp_number, raffle.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glow-red-sm mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-dark"
                >
                  <IconWhatsApp width={18} height={18} />
                  Consultar por WhatsApp
                </a>
              ) : null}
            </div>
          )}

          {raffle.terms ? (
            <details className="mt-6 rounded-2xl border border-line bg-card p-4">
              <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-fg-soft">
                Condiciones de este sorteo
              </summary>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-fg-soft">
                {raffle.terms}
              </p>
            </details>
          ) : null}
        </div>
      </main>
      <Footer settings={settings} hideWhatsApp={!raffle.whatsappCheckout} />
      {/* Si esta rifa no cierra por WhatsApp, no se le muestra al cliente. */}
      <BottomBar
        whatsappNumber={settings.whatsapp_number}
        hideWhatsApp={!raffle.whatsappCheckout}
      />
    </>
  );
}
