"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCop } from "@/lib/format";
import { statusMetaV2 } from "@/lib/raffle-status";
import { btnOutline } from "./ui";
import { IconImage, IconPencil } from "@/components/icons";

export type AdminRaffleRow = {
  id: string;
  slug: string;
  title: string;
  prize: string;
  imageUrl: string | null;
  status: string;
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
}: {
  raffles: AdminRaffleRow[];
  canManage: boolean;
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
        return (
          <article
            key={raffle.id}
            className="rounded-2xl border border-line bg-card p-4 shadow-card"
          >
            <div className="flex gap-3.5">
              {raffle.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={raffle.imageUrl}
                  alt=""
                  className="h-[72px] w-[72px] shrink-0 rounded-xl border border-line object-cover"
                />
              ) : (
                <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl bg-well text-fg-faint">
                  <IconImage width={26} height={26} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-base font-extrabold text-fg">
                  {raffle.title}
                </h2>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${meta.badgeClass}`}
                  >
                    {meta.label}
                  </span>
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
                href={`/sorteo/${raffle.slug}`}
                target="_blank"
                className={btnOutline}
              >
                Ver
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
