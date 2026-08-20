"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCop } from "@/lib/format";
import { statusMetaV2 } from "@/lib/raffle-status";
import { btnOutline } from "./ui";
import { IconEye, IconImage, IconPencil } from "@/components/icons";

/**
 * Estados que el público sí ve (copia de PUBLIC_STATUSES de src/lib/public.ts;
 * aquí se repite porque ese módulo habla con Prisma y no puede entrar en un
 * componente de cliente). En los demás —borrador, cancelada— la página del
 * sorteo es una VISTA PREVIA que solo abre quien tiene sesión de panel.
 */
const ESTADOS_PUBLICOS = new Set([
  "COMING_SOON",
  "ACTIVE",
  "SOLD_OUT",
  "FINISHED",
]);

/**
 * Estados en los que la rifa puede dejar a un comprador delante de la pantalla
 * «Realiza el pago»: ACTIVA vende de verdad y PRÓXIMAMENTE está a un toque de
 * hacerlo. Agotada y finalizada también son públicas, pero ya no toman pedidos
 * nuevos, así que marcarlas en rojo sería una falsa alarma. Misma lista que la
 * de RaffleFormV2.
 */
const ESTADOS_QUE_COBRAN = new Set(["COMING_SOON", "ACTIVE"]);

export type AdminRaffleRow = {
  id: string;
  slug: string;
  title: string;
  prize: string;
  imageUrl: string | null;
  status: string;
  /** Si esta rifa cierra la compra por WhatsApp. */
  whatsappCheckout: boolean;
  /**
   * Si esta rifa ofrece el pago con pasarela. Es solo la decisión del dueño:
   * para que cobre de verdad hace falta además que la tienda tenga pasarela
   * configurada (`pasarelaLista`).
   */
  gatewayCheckout: boolean;
  progressPct: number;
  progressMode: string;
  pricePerNumber: number;
  totalNumbers: number;
  paid: number;
  reserved: number;
  blocked: number;
  displayOrder: number;
};

export default function RaffleListV2({
  raffles,
  canManage,
  pasarelaLista,
}: {
  raffles: AdminRaffleRow[];
  canManage: boolean;
  /**
   * Si la tienda tiene ALGUNA pasarela de pago configurada (Wompi o Bold). Lo
   * decide el SERVIDOR (hayPasarela, de src/lib/pasarela.ts, en la
   * página) y baja al navegador como un simple sí o no: las llaves de la
   * pasarela no salen nunca del servidor.
   */
  pasarelaLista: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function duplicate(id: string) {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch(`/api/admin/raffles/${id}/duplicate`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible duplicar");
        return;
      }
      router.push(`/admin/rifas/${data.raffle.id}`);
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(raffle: AdminRaffleRow) {
    if (
      !window.confirm(
        `¿Eliminar la rifa "${raffle.title}"? Solo es posible si no tiene pedidos.`
      )
    ) {
      return;
    }
    setBusyId(raffle.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/raffles/${raffle.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible eliminar");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setBusyId(null);
    }
  }

  if (raffles.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-card p-6 text-sm text-fg-soft">
        Aún no hay rifas. Crea la primera con el botón “Nueva”.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm font-medium text-error"
        >
          {error}
        </p>
      ) : null}

      {raffles.map((raffle) => {
        const meta = statusMetaV2(raffle.status);
        const available =
          raffle.totalNumbers - raffle.paid - raffle.reserved - raffle.blocked;
        // Toda rifa se puede abrir en el sitio; si aún no es pública, lo que
        // se abre es la vista previa (y así se anuncia).
        const esPublica = ESTADOS_PUBLICOS.has(raffle.status);
        const verHref = `/sorteo/${raffle.slug}`;
        const verTexto = esPublica ? "Ver" : "Vista previa";
        const verTitulo = esPublica
          ? "Abrir la página del sorteo en el sitio"
          : "Solo tú puedes verla: el público todavía no";
        // Rifa de cara al público sin ninguna caja abierta: sus compradores
        // llegan a la pantalla de pago sin un solo botón. Se marca en rojo
        // para que se vea de un vistazo, sin entrar a editarla. La pasarela
        // cuenta solo si el dueño la encendió en la rifa Y la tienda la tiene
        // configurada: encendida sin configurar no cobra nada.
        const sinFormaDeCobro =
          ESTADOS_QUE_COBRAN.has(raffle.status) &&
          !raffle.whatsappCheckout &&
          !(raffle.gatewayCheckout && pasarelaLista);
        return (
          <article
            key={raffle.id}
            className="rounded-2xl border border-line bg-card p-4 shadow-card"
          >
            <div className="flex gap-3.5">
              {/* Foto y título llevan al sitio: del panel al sorteo de un toque. */}
              <Link
                href={verHref}
                target="_blank"
                title={verTitulo}
                aria-label={`${verTexto}: ${raffle.title}`}
                className="shrink-0 rounded-xl transition-opacity hover:opacity-80"
              >
                {raffle.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={raffle.imageUrl}
                    alt=""
                    className="h-[72px] w-[72px] rounded-xl border border-line object-cover"
                  />
                ) : (
                  <span className="flex h-[72px] w-[72px] items-center justify-center rounded-xl bg-well text-fg-faint">
                    <IconImage width={26} height={26} />
                  </span>
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-base font-extrabold text-fg">
                  <Link
                    href={verHref}
                    target="_blank"
                    title={verTitulo}
                    className="transition-colors hover:text-brand"
                  >
                    {raffle.title}
                  </Link>
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.badgeClass}`}
                  >
                    {meta.label}
                  </span>
                  {sinFormaDeCobro ? (
                    <span
                      title="WhatsApp apagado y sin pasarela de pago: el comprador llega a «Realiza el pago» y no le aparece ningún botón. Ábrela y enciende WhatsApp, o déjala en borrador."
                      className="rounded-full border border-error/50 bg-error/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-error"
                    >
                      Sin forma de cobrar
                    </span>
                  ) : null}
                  <span className="text-xs tabular-nums text-fg-soft">
                    {raffle.progressPct}%
                    {raffle.progressMode === "MANUAL" ? " (manual)" : ""} ·{" "}
                    {formatCop(raffle.pricePerNumber)}/número
                  </span>
                </div>
                {/* Cantidades reales: SOLO en el panel, jamás públicas */}
                <p className="mt-1.5 text-xs tabular-nums text-fg-faint">
                  {raffle.paid.toLocaleString("es-CO")} vendidos ·{" "}
                  {raffle.reserved.toLocaleString("es-CO")} reservados ·{" "}
                  {raffle.blocked.toLocaleString("es-CO")} bloqueados ·{" "}
                  {available.toLocaleString("es-CO")} libres de{" "}
                  {raffle.totalNumbers.toLocaleString("es-CO")}
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <Link
                href={verHref}
                target="_blank"
                title={verTitulo}
                className={btnOutline}
              >
                <IconEye width={15} height={15} />
                {verTexto}
              </Link>
              <Link href={`/admin/numeros?raffleId=${raffle.id}`} className={btnOutline}>
                Números
              </Link>
              {canManage ? (
                <>
                  <button
                    type="button"
                    onClick={() => duplicate(raffle.id)}
                    disabled={busyId === raffle.id}
                    className={btnOutline}
                  >
                    Duplicar
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(raffle)}
                    disabled={busyId === raffle.id}
                    className={btnOutline}
                  >
                    Eliminar
                  </button>
                  <Link
                    href={`/admin/rifas/${raffle.id}`}
                    className="glow-brand-sm inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand px-4 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-dark"
                  >
                    <IconPencil width={15} height={15} />
                    Editar
                  </Link>
                </>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
