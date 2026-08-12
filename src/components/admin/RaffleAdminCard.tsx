"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { statusMeta } from "@/lib/raffle-status";
import { IconImage, IconPencil, IconTrash } from "@/components/icons";

export type AdminRaffleItem = {
  id: string;
  title: string;
  prize: string;
  imageUrl: string | null;
  progressPct: number;
  status: string;
  isPublished: boolean;
  displayOrder: number;
};

export default function RaffleAdminCard({ raffle }: { raffle: AdminRaffleItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const meta = statusMeta(raffle.status);

  async function togglePublished() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/raffles/${raffle.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !raffle.isPublished }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No fue posible actualizar");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (
      !window.confirm(
        `¿Eliminar definitivamente la rifa "${raffle.title}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/raffles/${raffle.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No fue posible eliminar");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de conexión");
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-2xl border border-line bg-card p-4 shadow-card">
      <div className="flex gap-3.5">
        {raffle.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={raffle.imageUrl}
            alt=""
            className="h-[72px] w-[72px] shrink-0 rounded-xl border border-line object-cover"
          />
        ) : (
          <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl bg-well text-fg-soft/50">
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
            {!raffle.isPublished ? (
              <span className="rounded-full bg-well px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-fg-soft">
                Oculta
              </span>
            ) : null}
            <span className="text-xs tabular-nums text-fg-soft">
              {raffle.progressPct}% · Orden {raffle.displayOrder}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex items-center justify-between gap-3">
        <label className="flex cursor-pointer select-none items-center gap-2.5">
          <button
            type="button"
            role="switch"
            aria-checked={raffle.isPublished}
            aria-label={raffle.isPublished ? "Desactivar rifa" : "Activar rifa"}
            disabled={busy}
            onClick={togglePublished}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
              raffle.isPublished ? "bg-brand" : "bg-line"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                raffle.isPublished ? "left-6" : "left-1"
              }`}
            />
          </button>
          <span className="text-xs font-bold uppercase tracking-wide text-fg-soft">
            {raffle.isPublished ? "Visible" : "Oculta"}
          </span>
        </label>

        <div className="flex gap-2">
          <Link
            href={`/admin/rifas/${raffle.id}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line px-3.5 text-xs font-bold uppercase tracking-wide text-fg transition-colors hover:border-brand hover:text-brand"
          >
            <IconPencil width={15} height={15} />
            Editar
          </Link>
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            aria-label="Eliminar rifa"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line text-fg-soft transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
          >
            <IconTrash width={16} height={16} />
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-2.5 text-xs font-semibold text-brand">
          {error}
        </p>
      ) : null}
    </article>
  );
}
