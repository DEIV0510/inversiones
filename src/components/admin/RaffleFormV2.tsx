"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { slugify } from "@/lib/slug";
import { formatCop } from "@/lib/format";
import { RAFFLE_STATUSES_V2, STATUS_META_V2, type RaffleStatusV2 } from "@/lib/raffle-status";
import { btnOutline, btnPrimary, helpCls, inputCls, labelCls } from "./ui";
import { IconImage, IconTrash, IconX } from "@/components/icons";

export type RaffleFormInitial = {
  id: string;
  slug: string;
  title: string;
  description: string;
  prize: string;
  imageUrl: string | null;
  gallery: string[];
  pricePerNumber: number;
  totalNumbers: number;
  drawDateText: string | null;
  status: string;
  progressMode: string;
  manualProgressPct: number;
  reservationMinutes: number;
  maxNumbersPerOrder: number;
  terms: string;
  displayOrder: number;
  hasOrders: boolean;
};

const TOTAL_PRESETS = [100, 1000, 10000, 100000, 1000000];

export default function RaffleFormV2({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: RaffleFormInitial;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [prize, setPrize] = useState(initial?.prize ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [gallery, setGallery] = useState<string[]>(initial?.gallery ?? []);
  const [price, setPrice] = useState(
    initial ? String(initial.pricePerNumber) : "10000"
  );
  const [totalNumbers, setTotalNumbers] = useState(
    initial ? String(initial.totalNumbers) : "10000"
  );
  const [drawDateText, setDrawDateText] = useState(initial?.drawDateText ?? "");
  const [status, setStatus] = useState<RaffleStatusV2>(
    (RAFFLE_STATUSES_V2 as readonly string[]).includes(initial?.status ?? "")
      ? (initial!.status as RaffleStatusV2)
      : "DRAFT"
  );
  const [progressMode, setProgressMode] = useState(initial?.progressMode ?? "AUTO");
  const [manualPct, setManualPct] = useState(initial?.manualProgressPct ?? 0);
  const [reservationMinutes, setReservationMinutes] = useState(
    String(initial?.reservationMinutes ?? 10)
  );
  const [maxPerOrder, setMaxPerOrder] = useState(
    String(initial?.maxNumbersPerOrder ?? 20)
  );
  const [terms, setTerms] = useState(initial?.terms ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    String(initial?.displayOrder ?? 0)
  );

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const totalInt = parseInt(totalNumbers || "0", 10) || 0;
  const digits = totalInt > 0 ? String(totalInt - 1).length : 0;

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function uploadFile(
    file: File,
    onDone: (url: string) => void
  ): Promise<void> {
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible subir la imagen");
        return;
      }
      onDone(data.url);
    } catch {
      setError("Error de conexión al subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  function buildPayload() {
    return {
      title: title.trim(),
      slug: slug.trim(),
      description: description.trim(),
      prize: prize.trim(),
      imageUrl,
      gallery,
      pricePerNumber: parseInt(price || "0", 10) || 0,
      totalNumbers: totalInt,
      drawDateText: drawDateText.trim(),
      status,
      progressMode: progressMode as "AUTO" | "MANUAL",
      manualProgressPct: manualPct,
      reservationMinutes: parseInt(reservationMinutes || "10", 10) || 10,
      maxNumbersPerOrder: parseInt(maxPerOrder || "20", 10) || 20,
      terms: terms.trim(),
      displayOrder: parseInt(displayOrder || "0", 10) || 0,
    };
  }

  async function save() {
    setError("");
    setSaving(true);
    try {
      const res = await fetch(
        mode === "create" ? "/api/admin/raffles" : `/api/admin/raffles/${initial!.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible guardar");
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

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="flex flex-col gap-5"
    >
      {/* Imagen principal */}
      <div className="rounded-2xl border border-line bg-card p-4">
        <p className={labelCls}>Imagen principal del premio</p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) uploadFile(f, (url) => setImageUrl(url));
          }}
          aria-label="Seleccionar imagen principal"
        />
        {imageUrl ? (
          <div className="overflow-hidden rounded-xl border border-line">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="Imagen del sorteo" className="aspect-[4/3] w-full object-cover" />
            <div className="grid grid-cols-2 gap-2 p-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className={btnOutline}
              >
                <IconImage width={15} height={15} />
                {uploading ? "Subiendo…" : "Cambiar"}
              </button>
              <button
                type="button"
                onClick={() => setImageUrl(null)}
                disabled={uploading}
                className={btnOutline}
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

        {/* Galería adicional */}
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-fg-faint">
            Imágenes adicionales ({gallery.length}/4)
          </p>
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f && gallery.length < 4)
                uploadFile(f, (url) => setGallery((g) => [...g, url]));
            }}
            aria-label="Agregar imagen a la galería"
          />
          <div className="mt-2 grid grid-cols-4 gap-2">
            {gallery.map((url) => (
              <div key={url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="aspect-square w-full rounded-lg border border-line object-cover" />
                <button
                  type="button"
                  onClick={() => setGallery((g) => g.filter((u) => u !== url))}
                  aria-label="Quitar imagen"
                  className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-brand text-white"
                >
                  <IconX width={12} height={12} />
                </button>
              </div>
            ))}
            {gallery.length < 4 ? (
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                disabled={uploading}
                className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-line text-fg-faint hover:border-brand hover:text-brand disabled:opacity-50"
                aria-label="Agregar imagen"
              >
                +
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Información */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
        <div>
          <label htmlFor="rf-title" className={labelCls}>Nombre del sorteo *</label>
          <input id="rf-title" type="text" required value={title} onChange={(e) => onTitleChange(e.target.value)} className={inputCls} placeholder="Ej: Gran Sorteo Moto 0 KM" maxLength={120} />
        </div>
        <div>
          <label htmlFor="rf-slug" className={labelCls}>URL (slug)</label>
          <input
            id="rf-slug"
            type="text"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(slugify(e.target.value));
            }}
            className={`${inputCls} font-mono text-sm`}
            placeholder="gran-sorteo-moto"
          />
          <p className={helpCls}>La página será /sorteo/{slug || "…"}</p>
        </div>
        <div>
          <label htmlFor="rf-prize" className={labelCls}>Premio *</label>
          <input id="rf-prize" type="text" required value={prize} onChange={(e) => setPrize(e.target.value)} className={inputCls} placeholder="Ej: Motocicleta 0 KM + $2.000.000" maxLength={160} />
        </div>
        <div>
          <label htmlFor="rf-desc" className={labelCls}>Descripción</label>
          <textarea id="rf-desc" value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} min-h-24 py-3`} placeholder="Descripción comercial del sorteo" maxLength={2000} rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rf-price" className={labelCls}>Precio por número *</label>
            <input id="rf-price" type="text" inputMode="numeric" required value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} className={inputCls} placeholder="10000" />
            <p className={helpCls}>{price ? formatCop(parseInt(price, 10) || 0) : ""}</p>
          </div>
          <div>
            <label htmlFor="rf-date" className={labelCls}>Fecha del sorteo</label>
            <input id="rf-date" type="text" value={drawDateText} onChange={(e) => setDrawDateText(e.target.value)} className={inputCls} placeholder="Ej: 30 de agosto" maxLength={120} />
          </div>
        </div>
      </div>

      {/* Números */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
        <div>
          <label htmlFor="rf-total" className={labelCls}>Cantidad total de números *</label>
          <div className="mb-2 grid grid-cols-5 gap-1.5">
            {TOTAL_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setTotalNumbers(String(preset))}
                disabled={mode === "edit" && initial?.hasOrders}
                className={`min-h-10 rounded-lg text-[11px] font-bold tabular-nums ${
                  totalInt === preset
                    ? "glow-red-sm bg-brand text-white"
                    : "border border-line bg-well text-fg-soft hover:border-brand disabled:opacity-40"
                }`}
              >
                {preset.toLocaleString("es-CO")}
              </button>
            ))}
          </div>
          <input
            id="rf-total"
            type="text"
            inputMode="numeric"
            required
            value={totalNumbers}
            onChange={(e) => setTotalNumbers(e.target.value.replace(/\D/g, "").slice(0, 8))}
            className={inputCls}
            disabled={mode === "edit" && initial?.hasOrders}
          />
          <p className={helpCls}>
            {totalInt > 0
              ? `Números de ${digits} dígitos: ${"0".repeat(digits)} a ${String(totalInt - 1).padStart(digits, "0")}`
              : "Define la cantidad (10 a 10.000.000)"}
            {mode === "edit" && initial?.hasOrders
              ? " · Con pedidos existentes no se puede cambiar."
              : ""}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rf-reserva" className={labelCls}>Minutos de reserva</label>
            <input id="rf-reserva" type="text" inputMode="numeric" value={reservationMinutes} onChange={(e) => setReservationMinutes(e.target.value.replace(/\D/g, "").slice(0, 4))} className={inputCls} />
            <p className={helpCls}>Tiempo para pagar antes de liberar.</p>
          </div>
          <div>
            <label htmlFor="rf-max" className={labelCls}>Máx. números por pedido</label>
            <input id="rf-max" type="text" inputMode="numeric" value={maxPerOrder} onChange={(e) => setMaxPerOrder(e.target.value.replace(/\D/g, "").slice(0, 3))} className={inputCls} />
          </div>
        </div>
      </div>

      {/* Estado y progreso */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
        <div>
          <label htmlFor="rf-status" className={labelCls}>Estado</label>
          <select id="rf-status" value={status} onChange={(e) => setStatus(e.target.value as RaffleStatusV2)} className={inputCls}>
            {RAFFLE_STATUSES_V2.map((s) => (
              <option key={s} value={s}>{STATUS_META_V2[s].label}</option>
            ))}
          </select>
        </div>
        <div>
          <p className={labelCls}>Porcentaje de avance público</p>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-line bg-well p-1.5">
            {(["AUTO", "MANUAL"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setProgressMode(m)}
                aria-pressed={progressMode === m}
                className={`min-h-10 rounded-lg text-xs font-bold uppercase tracking-wide ${
                  progressMode === m ? "glow-red-sm bg-brand text-white" : "text-fg-soft"
                }`}
              >
                {m === "AUTO" ? "Automático" : "Manual"}
              </button>
            ))}
          </div>
          {progressMode === "AUTO" ? (
            <p className={helpCls}>
              Se calcula solo: vendidos ÷ total. El público NUNCA ve cantidades,
              solo el porcentaje.
            </p>
          ) : (
            <div className="mt-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold text-fg">Porcentaje manual</span>
                <span className="font-display text-xl font-black tabular-nums text-brand">{manualPct}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={manualPct}
                onChange={(e) => setManualPct(parseInt(e.target.value, 10))}
                className="range-brand"
                aria-label="Porcentaje de avance manual"
              />
            </div>
          )}
        </div>
        <div>
          <label htmlFor="rf-order" className={labelCls}>Orden de aparición</label>
          <input id="rf-order" type="text" inputMode="numeric" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value.replace(/\D/g, "").slice(0, 4))} className={inputCls} />
          <p className={helpCls}>Menor número aparece primero.</p>
        </div>
        <div>
          <label htmlFor="rf-terms" className={labelCls}>Términos y condiciones del sorteo</label>
          <textarea id="rf-terms" value={terms} onChange={(e) => setTerms(e.target.value)} className={`${inputCls} min-h-24 py-3`} placeholder="Condiciones específicas de esta rifa (visibles en su página)" maxLength={5000} rows={4} />
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm font-medium text-error">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        {mode === "edit" ? (
          <Link href={`/sorteo/${initial!.slug}`} target="_blank" className="inline-flex min-h-13 items-center justify-center rounded-xl border-2 border-line-strong px-4 text-sm font-bold uppercase tracking-wide text-fg transition-colors hover:border-brand hover:text-brand">
            Vista previa
          </Link>
        ) : (
          <Link href="/admin/rifas" className="inline-flex min-h-13 items-center justify-center rounded-xl border-2 border-line-strong px-4 text-sm font-bold uppercase tracking-wide text-fg-soft transition-colors hover:border-brand hover:text-fg">
            Cancelar
          </Link>
        )}
        <button type="submit" disabled={saving || uploading} className={`${btnPrimary} min-h-13`}>
          {saving ? "Guardando…" : mode === "create" ? "Crear rifa" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
