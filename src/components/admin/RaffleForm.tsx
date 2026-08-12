"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import RaffleCard from "@/components/landing/RaffleCard";
import { RAFFLE_STATUSES, STATUS_META, type RaffleStatus } from "@/lib/raffle-status";
import type { RaffleView } from "@/lib/types";
import { IconEye, IconImage, IconTrash, IconX } from "@/components/icons";

export type RaffleFormInitial = {
  id: string;
  title: string;
  description: string;
  prize: string;
  imageUrl: string | null;
  priceCop: number | null;
  drawDateText: string | null;
  progressPct: number;
  status: string;
  isPublished: boolean;
  displayOrder: number;
  totalNumbers: number | null;
  notes: string | null;
};

type Props = {
  mode: "create" | "edit";
  whatsappNumber: string;
  initial?: RaffleFormInitial;
};

const inputCls =
  "min-h-12 w-full rounded-xl border border-line bg-well px-4 text-base text-fg placeholder:text-fg-soft/50 focus:border-brand focus:outline-none";
const labelCls = "mb-1.5 block text-sm font-semibold text-fg";
const helpCls = "mt-1 text-xs text-fg-soft";

export default function RaffleForm({ mode, whatsappNumber, initial }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [prize, setPrize] = useState(initial?.prize ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [price, setPrice] = useState(
    initial?.priceCop != null ? String(initial.priceCop) : ""
  );
  const [drawDateText, setDrawDateText] = useState(initial?.drawDateText ?? "");
  const [progressPct, setProgressPct] = useState(initial?.progressPct ?? 0);
  const [status, setStatus] = useState<RaffleStatus>(
    (RAFFLE_STATUSES as readonly string[]).includes(initial?.status ?? "")
      ? (initial!.status as RaffleStatus)
      : "active"
  );
  const [isPublished, setIsPublished] = useState(initial?.isPublished ?? true);
  const [displayOrder, setDisplayOrder] = useState(
    initial != null ? String(initial.displayOrder) : "0"
  );
  const [totalNumbers, setTotalNumbers] = useState(
    initial?.totalNumbers != null ? String(initial.totalNumbers) : ""
  );
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible subir la imagen");
        return;
      }
      setImageUrl(data.url);
    } catch {
      setError("Error de conexión al subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  function parseIntOrNull(value: string): number | null {
    const digits = value.replace(/\D/g, "");
    if (digits === "") return null;
    return parseInt(digits, 10);
  }

  function buildPayload() {
    return {
      title: title.trim(),
      prize: prize.trim(),
      description: description.trim(),
      imageUrl: imageUrl,
      priceCop: parseIntOrNull(price),
      drawDateText: drawDateText.trim(),
      progressPct,
      status,
      isPublished,
      displayOrder: parseIntOrNull(displayOrder) ?? 0,
      totalNumbers: parseIntOrNull(totalNumbers),
      notes: notes.trim(),
    };
  }

  const previewRaffle: RaffleView = {
    id: initial?.id ?? "preview",
    title: title.trim() || "Título del sorteo",
    description: description.trim(),
    prize: prize.trim() || "Premio",
    imageUrl,
    priceCop: parseIntOrNull(price),
    drawDateText: drawDateText.trim() || null,
    progressPct,
    status,
  };

  async function save() {
    if (title.trim().length < 3) {
      setError("El título debe tener al menos 3 caracteres");
      return;
    }
    if (prize.trim().length < 2) {
      setError("Indica el premio del sorteo");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const url =
        mode === "create"
          ? "/api/admin/raffles"
          : `/api/admin/raffles/${initial!.id}`;
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible guardar los cambios");
        return;
      }
      router.push("/admin/rifas");
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (mode !== "edit" || !initial) return;
    if (
      !window.confirm(
        `¿Eliminar definitivamente la rifa "${initial.title}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/raffles/${initial.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "No fue posible eliminar");
        return;
      }
      router.push("/admin/rifas");
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-5"
    >
      {/* Imagen */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <p className={labelCls}>Imagen del premio</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
          aria-label="Seleccionar imagen desde el dispositivo"
        />
        {imageUrl ? (
          <div className="overflow-hidden rounded-xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt="Vista previa de la imagen del sorteo"
              className="aspect-[4/3] w-full object-cover"
            />
            <div className="grid grid-cols-2 gap-2 p-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line text-xs font-bold uppercase tracking-wide text-fg transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
              >
                <IconImage width={15} height={15} />
                {uploading ? "Subiendo…" : "Cambiar"}
              </button>
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                disabled={uploading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line text-xs font-bold uppercase tracking-wide text-fg-soft transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
              >
                <IconTrash width={15} height={15} />
                Quitar
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line bg-well text-fg-soft transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
          >
            <IconImage width={32} height={32} />
            <span className="text-sm font-bold uppercase tracking-wide">
              {uploading ? "Subiendo…" : "Subir imagen"}
            </span>
            <span className="text-xs">Desde la galería de tu celular</span>
          </button>
        )}
        <p className={helpCls}>
          La imagen se optimiza automáticamente para que cargue rápido.
        </p>
      </div>

      {/* Información principal */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
        <div>
          <label htmlFor="f-title" className={labelCls}>
            Título del sorteo *
          </label>
          <input
            id="f-title"
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputCls}
            placeholder="Ej: Gran Sorteo Moto 0 KM"
            maxLength={120}
          />
        </div>
        <div>
          <label htmlFor="f-prize" className={labelCls}>
            Premio *
          </label>
          <input
            id="f-prize"
            type="text"
            required
            value={prize}
            onChange={(e) => setPrize(e.target.value)}
            className={inputCls}
            placeholder="Ej: Motocicleta 0 KM"
            maxLength={120}
          />
        </div>
        <div>
          <label htmlFor="f-description" className={labelCls}>
            Descripción
          </label>
          <textarea
            id="f-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${inputCls} min-h-24 py-3`}
            placeholder="Descripción comercial del sorteo"
            maxLength={800}
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="f-price" className={labelCls}>
              Precio (COP)
            </label>
            <input
              id="f-price"
              type="text"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))}
              className={inputCls}
              placeholder="10000"
            />
            <p className={helpCls}>Vacío = “por anunciar”.</p>
          </div>
          <div>
            <label htmlFor="f-date" className={labelCls}>
              Fecha del sorteo
            </label>
            <input
              id="f-date"
              type="text"
              value={drawDateText}
              onChange={(e) => setDrawDateText(e.target.value)}
              className={inputCls}
              placeholder="Ej: 30 de agosto"
              maxLength={120}
            />
          </div>
        </div>
      </div>

      {/* Avance y estado */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="f-progress" className={labelCls}>
              Porcentaje de avance
            </label>
            <span className="font-display text-xl font-black tabular-nums text-brand">
              {progressPct}%
            </span>
          </div>
          <input
            id="f-progress"
            type="range"
            min={0}
            max={100}
            step={1}
            value={progressPct}
            onChange={(e) => setProgressPct(parseInt(e.target.value, 10))}
            className="h-2.5 w-full cursor-pointer appearance-none rounded-full bg-well accent-brand"
          />
          <p className={helpCls}>
            En la página solo se muestra este porcentaje, nunca cantidades de
            números.
          </p>
        </div>

        <div>
          <label htmlFor="f-status" className={labelCls}>
            Estado
          </label>
          <select
            id="f-status"
            value={status}
            onChange={(e) => setStatus(e.target.value as RaffleStatus)}
            className={inputCls}
          >
            {RAFFLE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_META[s].label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="f-order" className={labelCls}>
              Orden
            </label>
            <input
              id="f-order"
              type="text"
              inputMode="numeric"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(e.target.value.replace(/\D/g, ""))}
              className={inputCls}
              placeholder="0"
            />
            <p className={helpCls}>Menor número aparece primero.</p>
          </div>
          <div>
            <label htmlFor="f-total" className={labelCls}>
              Total de números
            </label>
            <input
              id="f-total"
              type="text"
              inputMode="numeric"
              value={totalNumbers}
              onChange={(e) => setTotalNumbers(e.target.value.replace(/\D/g, ""))}
              className={inputCls}
              placeholder="Opcional"
            />
            <p className={helpCls}>Interno: nunca visible al público.</p>
          </div>
        </div>

        <div>
          <label htmlFor="f-notes" className={labelCls}>
            Notas internas
          </label>
          <textarea
            id="f-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputCls} min-h-20 py-3`}
            placeholder="Información adicional (solo visible para ti)"
            maxLength={800}
            rows={2}
          />
        </div>

        <label className="flex cursor-pointer select-none items-center justify-between gap-3 rounded-xl bg-well px-4 py-3.5">
          <span className="text-sm font-semibold text-fg">
            Rifa visible en la página
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={isPublished}
            aria-label={isPublished ? "Ocultar rifa de la página" : "Mostrar rifa en la página"}
            onClick={() => setIsPublished((v) => !v)}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              isPublished ? "bg-brand" : "bg-line"
            }`}
          >
            <span
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                isPublished ? "left-6" : "left-1"
              }`}
            />
          </button>
        </label>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm font-medium text-brand"
        >
          {error}
        </p>
      ) : null}

      {/* Acciones */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setShowPreview(true)}
          className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border-2 border-line-strong px-4 text-sm font-bold uppercase tracking-wide text-fg transition-colors hover:bg-well hover:text-white"
        >
          <IconEye width={17} height={17} />
          Vista previa
        </button>
        <button
          type="submit"
          disabled={saving || uploading}
          className="inline-flex min-h-13 items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving
            ? "Publicando…"
            : mode === "create"
              ? "Publicar rifa"
              : "Publicar cambios"}
        </button>
      </div>

      {mode === "edit" ? (
        <button
          type="button"
          onClick={remove}
          disabled={deleting}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand/40 px-4 text-sm font-bold uppercase tracking-wide text-brand transition-colors hover:bg-brand hover:text-white disabled:opacity-50"
        >
          <IconTrash width={16} height={16} />
          {deleting ? "Eliminando…" : "Eliminar rifa"}
        </button>
      ) : null}

      {/* Modal de vista previa */}
      {showPreview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Vista previa de la rifa"
          onClick={() => setShowPreview(false)}
        >
          <div
            className="w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/80">
                Así se verá en la página
              </p>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                aria-label="Cerrar vista previa"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-card/10 text-white transition-colors hover:bg-card/20"
              >
                <IconX width={18} height={18} />
              </button>
            </div>
            <div className="max-h-[70dvh] overflow-y-auto rounded-2xl">
              <RaffleCard raffle={previewRaffle} whatsappNumber={whatsappNumber} />
            </div>
            <button
              type="button"
              disabled={saving || uploading}
              onClick={() => {
                setShowPreview(false);
                save();
              }}
              className="mt-4 inline-flex min-h-13 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
            >
              {saving ? "Publicando…" : "Publicar cambios"}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}
