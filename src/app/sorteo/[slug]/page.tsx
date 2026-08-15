import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import BottomBar from "@/components/landing/BottomBar";
import ProgressBar from "@/components/landing/ProgressBar";
import NumberPicker from "@/components/public/NumberPicker";
import PreviewBanner from "@/components/landing/PreviewBanner";
import { getVerifiedSession } from "@/lib/auth";
import { formatCop } from "@/lib/format";
import {
  getPrizedGroups,
  getPublicRaffleBySlug,
  getRaffleBySlugForAdmin,
} from "@/lib/public";
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

/**
 * Texto del bloque de compra cuando la rifa no está activa. Los estados
 * DRAFT y CANCELLED solo se leen en vista previa, porque el público nunca
 * llega a esas páginas.
 */
const TEXTO_NO_ACTIVA: Record<string, string> = {
  COMING_SOON: "Este sorteo abre muy pronto",
  SOLD_OUT: "Boletas agotadas",
  FINISHED: "Sorteo finalizado",
  CANCELLED: "Sorteo cancelado",
  DRAFT: "Todavía no has publicado este sorteo",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const raffle = await getPublicRaffleBySlug(slug);
  if (!raffle) {
    // Puede ser una vista previa: solo con sesión de panel se nombra la rifa,
    // y aun así se pide a los buscadores que no la indexen.
    const sesion = await getVerifiedSession();
    if (!sesion) return { title: "Sorteo no encontrado" };
    const borrador = await getRaffleBySlugForAdmin(slug);
    if (!borrador) return { title: "Sorteo no encontrado" };
    return {
      title: `Vista previa · ${borrador.title}`,
      robots: { index: false, follow: false },
    };
  }
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
  const [publica, settings] = await Promise.all([
    getPublicRaffleBySlug(slug),
    getSettings(),
  ]);

  // Si la rifa no es visible al público (nace en borrador, o quedó cancelada)
  // la página existe SOLO para quien tiene sesión de panel: así el dueño ve
  // lo que acaba de crear antes de publicarlo. La comprobación es silenciosa
  // —no redirige al login— porque para un visitante esta página no existe y
  // tiene que seguir devolviendo un 404 normal.
  let raffle = publica;
  let vistaPrevia = false;
  if (!raffle) {
    const sesion = await getVerifiedSession();
    if (!sesion) notFound();
    raffle = await getRaffleBySlugForAdmin(slug);
    if (!raffle) notFound();
    vistaPrevia = true;
  }

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
      {vistaPrevia ? (
        <PreviewBanner raffleId={raffle.id} status={raffle.status} />
      ) : null}
      {/* En vista previa la franja ámbar ocupa sitio bajo la cabecera: el
          contenido arranca más abajo para que nada quede tapado. */}
      <main
        className={`relative mx-auto w-full max-w-3xl px-4 pb-40 sm:px-6 ${
          vistaPrevia ? "pt-36 lg:pt-40" : "pt-20 lg:pt-28"
        }`}
      >
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

          {/* Titular blanco que se funde en violeta, como la referencia */}
          <h1 className="title-gradient mt-5 font-display text-3xl font-black uppercase leading-[1.06] sm:text-4xl">
            {raffle.title}
          </h1>
          {raffle.description ? (
            <p className="mt-2.5 text-sm leading-relaxed text-fg-soft sm:text-base">
              {raffle.description}
            </p>
          ) : null}

          {/* Avance: va justo debajo del titular, como en la referencia */}
          <ProgressBar pct={raffle.progressPct} className="mt-5" />

          {/* Info: el precio va siempre; el premio y la fecha solo si el dueño
              los enciende, porque normalmente ya los dice el titular. Las filas
              que no se pintan no dejan hueco: divide-y solo pone la línea entre
              hermanos, así que con una sola fila la tarjeta queda limpia. */}
          <div className="mt-4 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {raffle.showPrize ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                  <IconGift width={16} height={16} className="text-brand" />
                  Premio
                </span>
                <span className="text-right font-display text-sm font-extrabold text-fg">
                  {raffle.prize}
                </span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                <IconTicket width={16} height={16} className="text-brand" />
                Precio por número
              </span>
              <span className="text-right font-display text-sm font-extrabold tabular-nums text-brand-light">
                {formatCop(raffle.pricePerNumber)}
              </span>
            </div>
            {raffle.showDrawDate ? (
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <span className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-fg-faint">
                  <IconCalendar width={16} height={16} className="text-brand" />
                  Fecha
                </span>
                <span className="text-right font-display text-sm font-extrabold text-fg">
                  {raffle.drawDateText?.trim() || "Por anunciar"}
                </span>
              </div>
            ) : null}
          </div>

          {/* Lista de premios configurada para este sorteo */}
          {raffle.prizes.length > 0 ? (
            <section className="mt-6" aria-labelledby="premios-sorteo">
              {/* Título de sección: punto fucsia + mayúsculas, como la referencia */}
              <h2
                id="premios-sorteo"
                className="flex items-center gap-2.5 font-display text-sm font-black uppercase tracking-[0.12em] text-fg"
              >
                <span
                  aria-hidden="true"
                  className="glow-brand-sm h-[7px] w-[7px] shrink-0 rounded-full bg-brand"
                />
                Premios de este sorteo
              </h2>
              <div className="mt-3 flex flex-col gap-2.5">
                {raffle.prizes.map((prize, i) => {
                  const Icon = i === 0 ? IconTrophy : IconGift;
                  return (
                    <div
                      key={`${i}-${prize.title}`}
                      className={`flex items-start gap-3.5 rounded-2xl bg-card p-4 ${
                        i === 0 ? "neon-card" : "border border-line"
                      }`}
                    >
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${
                          i === 0
                            ? "bg-brand/15 text-brand ring-brand/30"
                            : "bg-well text-brand-violet ring-line"
                        }`}
                      >
                        <Icon width={20} height={20} />
                      </span>
                      <div className="min-w-0 flex-1">
                        {prize.label ? (
                          <p className="text-[10px] font-bold uppercase leading-tight tracking-[0.16em] text-brand-violet">
                            {prize.label}
                          </p>
                        ) : null}
                        {prize.amount ? (
                          <p className="mt-1.5 break-words font-display text-2xl font-black leading-none tabular-nums text-brand sm:text-3xl">
                            {prize.amount}
                          </p>
                        ) : null}
                        <p className="mt-1.5 break-words text-sm font-semibold leading-snug text-fg">
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

          {/* Números premiados: se publican para que la gente los busque. */}
          {prizedGroups.length > 0 ? (
            <section className="mt-6 flex flex-col gap-4">
              {prizedGroups.map((grupo) => (
                <div
                  key={grupo.prize}
                  className="rounded-2xl border border-line bg-card p-4"
                >
                  {/* Mismo título de sección con punto fucsia */}
                  <h2 className="flex items-start gap-2.5 font-display text-sm font-black uppercase leading-tight tracking-[0.12em] text-fg sm:text-base">
                    <span
                      aria-hidden="true"
                      className="glow-brand-sm mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-brand"
                    />
                    <span className="min-w-0">
                      {grupo.numbers.length}{" "}
                      {grupo.numbers.length === 1 ? "número premiado" : "números premiados"}{" "}
                      con {grupo.prize}
                    </span>
                  </h2>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {grupo.numbers.map((n) => (
                      <span
                        key={n}
                        className="rounded-lg bg-well px-2.5 py-1.5 font-display text-sm font-bold tabular-nums tracking-wider text-brand-light ring-1 ring-brand/30"
                      >
                        {n}
                      </span>
                    ))}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-fg-soft">
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
                {TEXTO_NO_ACTIVA[raffle.status] ?? "Sorteo no disponible"}
              </p>
              {vistaPrevia && raffle.status === "DRAFT" ? (
                <p className="mt-2 text-sm leading-relaxed text-fg-soft">
                  Cuando lo pongas en “Activa”, aquí aparecerá la selección de
                  números tal como la verá el comprador.
                </p>
              ) : null}
              {raffle.whatsappCheckout ? (
                <a
                  href={waConsult(settings.whatsapp_number, raffle.title)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glow-wa mt-4 inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-wa px-6 text-sm font-bold uppercase tracking-wide text-white hover:bg-wa-dark"
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
