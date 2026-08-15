"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { slugify } from "@/lib/slug";
import { formatCop } from "@/lib/format";
import { RAFFLE_STATUSES_V2, STATUS_META_V2, type RaffleStatusV2 } from "@/lib/raffle-status";
import { digitsForTotal } from "@/lib/numbers";
import { btnOutline, btnPrimary, helpCls, inputCls, labelCls } from "./ui";
import { IconImage, IconPlus, IconTrash, IconX } from "@/components/icons";

export type RafflePrizeInitial = {
  label: string;
  title: string;
  amount: string;
  note: string;
};

export type RafflePrizedNumberInitial = { number: number; prize: string };

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
  digits: number;
  selectionMode: string;
  whatsappCheckout: boolean;
  ticketPacks: number[];
  prizes: RafflePrizeInitial[];
  prizedNumbers: RafflePrizedNumberInitial[];
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
const DIGIT_PRESETS = [2, 3, 4, 5, 6, 7];
const MIN_DIGITS = 2;
const MAX_DIGITS = 7;
const DEFAULT_PACKS = [1, 2, 5, 10];
const MAX_PACKS = 12;
const MAX_PRIZES = 12;
const MAX_PRIZED_NUMBERS = 50;

const SELECTION_MODES = [
  { value: "MANUAL", label: "Solo manual" },
  { value: "RANDOM", label: "Solo al azar" },
  { value: "BOTH", label: "Las dos" },
] as const;

type SelectionModeValue = (typeof SELECTION_MODES)[number]["value"];

type PrizeRow = {
  id: string;
  label: string;
  title: string;
  amount: string;
  note: string;
};

type PrizedNumberRow = { id: string; number: string; prize: string };

/**
 * Ids solo para las keys de React y los `htmlFor` (no se guardan ni se
 * envÃ­an). Las filas iniciales usan su posiciÃ³n para que el servidor y el
 * navegador generen exactamente los mismos ids; las que agrega el usuario
 * (ya en el navegador) usan un contador que no afecta la hidrataciÃ³n.
 */
let addedRowSeq = 0;
function nextRowId(): string {
  addedRowSeq += 1;
  return `nueva-${addedRowSeq}`;
}

/** Cifras mÃ­nimas que necesita una cantidad total de nÃºmeros. */
function neededDigits(total: number): number {
  if (total <= 0) return MIN_DIGITS;
  return Math.min(MAX_DIGITS, Math.max(MIN_DIGITS, digitsForTotal(total)));
}

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
  const [digits, setDigits] = useState(() =>
    initial?.digits
      ? Math.min(MAX_DIGITS, Math.max(MIN_DIGITS, initial.digits))
      : neededDigits(initial?.totalNumbers ?? 10000)
  );
  const [digitsNote, setDigitsNote] = useState("");
  const [selectionMode, setSelectionMode] = useState<SelectionModeValue>(() =>
    SELECTION_MODES.some((m) => m.value === initial?.selectionMode)
      ? (initial!.selectionMode as SelectionModeValue)
      : "BOTH"
  );
  const [whatsappCheckout, setWhatsappCheckout] = useState(
    initial?.whatsappCheckout ?? true
  );
  const [ticketPacks, setTicketPacks] = useState<number[]>(() =>
    initial?.ticketPacks?.length ? [...initial.ticketPacks] : [...DEFAULT_PACKS]
  );
  const [packDraft, setPackDraft] = useState("");
  const [prizes, setPrizes] = useState<PrizeRow[]>(() =>
    (initial?.prizes ?? []).map((p, i) => ({
      id: `premio-${i}`,
      label: p.label ?? "",
      title: p.title ?? "",
      amount: p.amount ?? "",
      note: p.note ?? "",
    }))
  );
  const [prizedNumbers, setPrizedNumbers] = useState<PrizedNumberRow[]>(() =>
    (initial?.prizedNumbers ?? []).map((p, i) => ({
      id: `premiado-${i}`,
      number: String(p.number),
      prize: p.prize ?? "",
    }))
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
  const capacity = Math.pow(10, digits);
  const numbersLocked = mode === "edit" && !!initial?.hasOrders;

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  /** Cambia las cifras y baja el total si ya no cabe. */
  function applyDigits(next: number) {
    setDigits(next);
    const cap = Math.pow(10, next);
    if (cap < totalInt) {
      setTotalNumbers(String(cap));
      setDigitsNote(
        `Bajamos la cantidad a ${cap.toLocaleString("es-CO")} nÃºmeros: es todo lo que cabe en ${next} cifras.`
      );
    } else {
      setDigitsNote("");
    }
  }

  /** Cambia el total y sube las cifras si hacen falta. */
  function applyTotal(raw: string) {
    const clean = raw.replace(/\D/g, "").slice(0, 8);
    setTotalNumbers(clean);
    const value = parseInt(clean || "0", 10) || 0;
    const need = neededDigits(value);
    if (value > 0 && need > digits) {
      setDigits(need);
      setDigitsNote(
        `Subimos a ${need} cifras para que quepan ${value.toLocaleString("es-CO")} nÃºmeros.`
      );
    } else {
      setDigitsNote("");
    }
  }

  function addPack() {
    const value = parseInt(packDraft || "0", 10) || 0;
    if (value < 1 || value > 5000) return;
    setPackDraft("");
    if (ticketPacks.length >= MAX_PACKS || ticketPacks.includes(value)) return;
    setTicketPacks([...ticketPacks, value].sort((a, b) => a - b));
  }

  function updatePrize(id: string, patch: Partial<PrizeRow>) {
    setPrizes((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function updatePrizedNumber(id: string, patch: Partial<PrizedNumberRow>) {
    setPrizedNumbers((rows) =>
      rows.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
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
      setError("Error de conexiÃ³n al subir la imagen");
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
      digits,
      selectionMode,
      whatsappCheckout,
      ticketPacks,
      prizes: prizes
        .filter(
          (p) =>
            p.label.trim() || p.title.trim() || p.amount.trim() || p.note.trim()
        )
        .map((p) => ({
          label: p.label.trim(),
          title: p.title.trim(),
          amount: p.amount.trim(),
          note: p.note.trim(),
        })),
      prizedNumbers: prizedNumbers
        .filter((p) => p.number.trim() !== "" || p.prize.trim() !== "")
        .map((p) => ({
          number: parseInt(p.number || "0", 10) || 0,
          prize: p.prize.trim(),
        })),
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
      setError("Error de conexiÃ³n. Intenta de nuevo.");
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
                {uploading ? "Subiendoâ€¦" : "Cambiar"}
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
              {uploading ? "Subiendoâ€¦" : "Subir imagen"}
            </span>
            <span className="text-xs">Desde la galerÃ­a de tu celular</span>
          </button>
        )}

        {/* GalerÃ­a adicional */}
        <div className="mt-3">
          <p className="text-xs font-bold uppercase tracking-wide text-fg-faint">
            ImÃ¡genes adicionales ({gallery.length}/4)
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
            aria-label="Agregar imagen a la galerÃ­a"
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

      {/* InformaciÃ³n */}
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
          <p className={helpCls}>La pÃ¡gina serÃ¡ /sorteo/{slug || "â€¦"}</p>
        </div>
        <div>
          <label htmlFor="rf-prize" className={labelCls}>Premio *</label>
          <input id="rf-prize" type="text" required value={prize} onChange={(e) => setPrize(e.target.value)} className={inputCls} placeholder="Ej: Motocicleta 0 KM + $2.000.000" maxLength={160} />
        </div>
        <div>
          <label htmlFor="rf-desc" className={labelCls}>DescripciÃ³n</label>
          <textarea id="rf-desc" value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputCls} min-h-24 py-3`} placeholder="DescripciÃ³n comercial del sorteo" maxLength={2000} rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="rf-price" className={labelCls}>Precio por nÃºmero *</label>
            <input id="rf-price" type="text" inputMode="numeric" required value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} className={inputCls} placeholder="10000" />
            <p className={helpCls}>{price ? formatCop(parseInt(price, 10) || 0) : ""}</p>
          </div>
          <div>
            <label htmlFor="rf-date" className={labelCls}>Fecha del sorteo</label>
            <input id="rf-date" type="text" value={drawDateText} onChange={(e) => setDrawDateText(e.target.value)} className={inputCls} placeholder="Ej: 30 de agosto" maxLength={120} />
          </div>
        </div>
      </div>

      {/* NÃºmeros */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
        <div>
          <p className={labelCls}>Cifras del nÃºmero *</p>
          <div className="grid grid-cols-6 gap-1.5">
            {DIGIT_PRESETS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => applyDigits(d)}
                disabled={numbersLocked}
                aria-pressed={digits === d}
                className={`min-h-11 rounded-lg text-sm font-bold tabular-nums ${
                  digits === d
                    ? "glow-red-sm bg-brand text-white"
                    : "border border-line bg-well text-fg-soft hover:border-brand disabled:opacity-40"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <p className={helpCls}>
            Con {digits} cifras los nÃºmeros van de {"0".repeat(digits)} a{" "}
            {"9".repeat(digits)} ({capacity.toLocaleString("es-CO")} posibles).
            {digitsNote ? <span className="text-fg"> {digitsNote}</span> : null}
            {numbersLocked ? " Â· Con pedidos existentes no se puede cambiar." : ""}
          </p>
        </div>
        <div>
          <label htmlFor="rf-total" className={labelCls}>Cantidad total de nÃºmeros *</label>
          <div className="mb-2 grid grid-cols-5 gap-1.5">
            {TOTAL_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => applyTotal(String(preset))}
                disabled={numbersLocked}
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
            onChange={(e) => applyTotal(e.target.value)}
            className={inputCls}
            disabled={numbersLocked}
          />
          <p className={helpCls}>
            {totalInt > 0
              ? `Se venden del ${"0".repeat(digits)} al ${String(totalInt - 1).padStart(digits, "0")}`
              : "Define la cantidad (10 a 10.000.000)"}
            {numbersLocked
              ? " Â· Con pedidos existentes no se puede cambiar."
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
            <label htmlFor="rf-max" className={labelCls}>MÃ¡x. nÃºmeros por pedido</label>
            <input id="rf-max" type="text" inputMode="numeric" value={maxPerOrder} onChange={(e) => setMaxPerOrder(e.target.value.replace(/\D/g, "").slice(0, 4))} className={inputCls} />
          </div>
        </div>
      </div>

      {/* CÃ³mo compra el cliente */}
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
        <div>
          <p className={labelCls}>Â¿CÃ³mo elige sus nÃºmeros el comprador?</p>
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-line bg-well p-1.5">
            {SELECTION_MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setSelectionMode(m.value)}
                aria-pressed={selectionMode === m.value}
                className={`min-h-11 rounded-lg px-1 text-[11px] font-bold uppercase tracking-wide ${
                  selectionMode === m.value
                    ? "glow-red-sm bg-brand text-white"
                    : "text-fg-soft"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className={helpCls}>
            {selectionMode === "MANUAL"
              ? "Solo verÃ¡ el buscador para escoger sus nÃºmeros uno por uno."
              : selectionMode === "RANDOM"
                ? "El sistema le asigna los nÃºmeros al azar: no aparece la opciÃ³n manual."
                : "VerÃ¡ las dos opciones: escoger a mano o dejar que el sistema le asigne."}
          </p>
        </div>

        <label className="flex min-h-11 cursor-pointer select-none items-center justify-between gap-4 border-t border-line pt-4">
          <span>
            <span className="block text-sm font-semibold text-fg">
              Cerrar la compra por WhatsApp
            </span>
            <span className={helpCls}>
              {whatsappCheckout
                ? "Al comprar, el cliente pasa directo a tu WhatsApp con sus nÃºmeros y el cÃ³digo del pedido."
                : "Esta rifa no mostrarÃ¡ WhatsApp al cliente por ningÃºn lado. El sistema le entrega los nÃºmeros y el comprobante."}
            </span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={whatsappCheckout}
            aria-label={
              whatsappCheckout
                ? "Desactivar el cierre de compra por WhatsApp"
                : "Activar el cierre de compra por WhatsApp"
            }
            onClick={() => setWhatsappCheckout((v) => !v)}
            className="flex h-11 w-12 shrink-0 items-center justify-center"
          >
            <span
              className={`relative block h-7 w-12 rounded-full transition-colors ${
                whatsappCheckout ? "bg-brand" : "bg-line"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  whatsappCheckout ? "left-6" : "left-1"
                }`}
              />
            </span>
          </button>
        </label>

        <div>
          <p className={labelCls}>
            Paquetes de boletas ({ticketPacks.length}/{MAX_PACKS})
          </p>
          <div className="flex flex-wrap gap-2">
            {ticketPacks.length === 0 ? (
              <span className="text-sm text-fg-faint">
                Sin botones rÃ¡pidos: el comprador escribe la cantidad.
              </span>
            ) : null}
            {ticketPacks.map((q) => (
              <span
                key={q}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-well pl-4 pr-2 text-sm font-bold text-fg"
              >
                <span className="tabular-nums">
                  {q === 1 ? "1 boleta" : `${q} boletas`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setTicketPacks((packs) => packs.filter((x) => x !== q))
                  }
                  aria-label={`Quitar paquete de ${q}`}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-brand text-white"
                >
                  <IconX width={12} height={12} />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              id="rf-pack"
              type="text"
              inputMode="numeric"
              value={packDraft}
              onChange={(e) =>
                setPackDraft(e.target.value.replace(/\D/g, "").slice(0, 4))
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPack();
                }
              }}
              className={`${inputCls} w-24 text-center tabular-nums`}
              placeholder="20"
              aria-label="Cantidad de boletas del paquete"
              disabled={ticketPacks.length >= MAX_PACKS}
            />
            <button
              type="button"
              onClick={addPack}
              disabled={ticketPacks.length >= MAX_PACKS || packDraft === ""}
              className={btnOutline}
            >
              <IconPlus width={14} height={14} />
              Agregar
            </button>
          </div>
          <p className={helpCls}>
            Son los botones rÃ¡pidos que verÃ¡ el comprador (ej. 2 boletas, 5
            boletas)
          </p>
        </div>
      </div>

      {/* Premios adicionales */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-fg">Premios adicionales</p>
          <span className="text-xs font-bold tabular-nums text-fg-faint">
            {prizes.length}/{MAX_PRIZES}
          </span>
        </div>
        {prizes.length === 0 ? (
          <p className="text-sm text-fg-soft">
            TodavÃ­a no hay premios. Agrega el premio mayor y los anticipados.
          </p>
        ) : null}
        {prizes.map((row, i) => (
          <div
            key={row.id}
            className="flex flex-col gap-2 rounded-xl border border-line bg-well p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-fg-faint">
                Premio {i + 1}
              </span>
              <button
                type="button"
                onClick={() =>
                  setPrizes((rows) => rows.filter((x) => x.id !== row.id))
                }
                aria-label={`Quitar premio ${i + 1}`}
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-fg-soft transition-colors hover:text-brand"
              >
                <IconTrash width={16} height={16} />
              </button>
            </div>
            <div>
              <label
                htmlFor={`rf-prize-label-${row.id}`}
                className="mb-1 block text-xs font-semibold text-fg-soft"
              >
                Etiqueta
              </label>
              <input
                id={`rf-prize-label-${row.id}`}
                type="text"
                value={row.label}
                onChange={(e) => updatePrize(row.id, { label: e.target.value })}
                className={inputCls}
                placeholder="Ej: ANTICIPADO Â· LUNES"
                maxLength={60}
              />
            </div>
            <div>
              <label
                htmlFor={`rf-prize-title-${row.id}`}
                className="mb-1 block text-xs font-semibold text-fg-soft"
              >
                Premio *
              </label>
              <input
                id={`rf-prize-title-${row.id}`}
                type="text"
                value={row.title}
                onChange={(e) => updatePrize(row.id, { title: e.target.value })}
                className={inputCls}
                placeholder="Ej: Premio mayor"
                maxLength={120}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor={`rf-prize-amount-${row.id}`}
                  className="mb-1 block text-xs font-semibold text-fg-soft"
                >
                  Monto
                </label>
                <input
                  id={`rf-prize-amount-${row.id}`}
                  type="text"
                  value={row.amount}
                  onChange={(e) => updatePrize(row.id, { amount: e.target.value })}
                  className={inputCls}
                  placeholder="1.000.000"
                  maxLength={60}
                />
              </div>
              <div>
                <label
                  htmlFor={`rf-prize-note-${row.id}`}
                  className="mb-1 block text-xs font-semibold text-fg-soft"
                >
                  Nota
                </label>
                <input
                  id={`rf-prize-note-${row.id}`}
                  type="text"
                  value={row.note}
                  onChange={(e) => updatePrize(row.id, { note: e.target.value })}
                  className={inputCls}
                  placeholder="LoterÃ­a de Cundinamarca"
                  maxLength={120}
                />
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setPrizes((rows) => [
              ...rows,
              { id: nextRowId(), label: "", title: "", amount: "", note: "" },
            ])
          }
          disabled={prizes.length >= MAX_PRIZES}
          className={btnOutline}
        >
          <IconPlus width={14} height={14} />
          Agregar premio
        </button>
        <p className={helpCls}>
          Se muestran en la pÃ¡gina del sorteo, debajo del premio principal.
        </p>
      </div>

      {/* Ticket premiado */}
      <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-semibold text-fg">Ticket premiado</p>
          <span className="text-xs font-bold tabular-nums text-fg-faint">
            {prizedNumbers.length}/{MAX_PRIZED_NUMBERS}
          </span>
        </div>
        {prizedNumbers.map((row, i) => (
          <div key={row.id} className="flex items-start gap-2">
            <div className="w-28 shrink-0">
              <label
                htmlFor={`rf-pn-number-${row.id}`}
                className="mb-1 block text-xs font-semibold text-fg-soft"
              >
                NÃºmero
              </label>
              <input
                id={`rf-pn-number-${row.id}`}
                type="text"
                inputMode="numeric"
                value={row.number}
                onChange={(e) =>
                  updatePrizedNumber(row.id, {
                    number: e.target.value.replace(/\D/g, "").slice(0, MAX_DIGITS),
                  })
                }
                className={`${inputCls} px-3 text-center font-mono tabular-nums`}
                placeholder={"0".repeat(digits)}
              />
            </div>
            <div className="min-w-0 flex-1">
              <label
                htmlFor={`rf-pn-prize-${row.id}`}
                className="mb-1 block text-xs font-semibold text-fg-soft"
              >
                Premio
              </label>
              <input
                id={`rf-pn-prize-${row.id}`}
                type="text"
                value={row.prize}
                onChange={(e) =>
                  updatePrizedNumber(row.id, { prize: e.target.value })
                }
                className={inputCls}
                placeholder="Ej: 200.000 de una"
                maxLength={120}
              />
            </div>
            <button
              type="button"
              onClick={() =>
                setPrizedNumbers((rows) => rows.filter((x) => x.id !== row.id))
              }
              aria-label={`Quitar nÃºmero premiado ${i + 1}`}
              className="mt-5 flex min-h-12 min-w-11 items-center justify-center rounded-lg text-fg-soft transition-colors hover:text-brand"
            >
              <IconTrash width={16} height={16} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setPrizedNumbers((rows) => [
              ...rows,
              { id: nextRowId(), number: "", prize: "" },
            ])
          }
          disabled={prizedNumbers.length >= MAX_PRIZED_NUMBERS}
          className={btnOutline}
        >
          <IconPlus width={14} height={14} />
          Agregar nÃºmero premiado
        </button>
        <p className={helpCls}>
          Si no quieres nÃºmeros premiados, deja la lista vacÃ­a
        </p>
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
          <p className={labelCls}>Porcentaje de avance pÃºblico</p>
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
                {m === "AUTO" ? "AutomÃ¡tico" : "Manual"}
              </button>
            ))}
          </div>
          {progressMode === "AUTO" ? (
            <p className={helpCls}>
              Se calcula solo: vendidos Ã· total. El pÃºblico NUNCA ve cantidades,
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
          <label htmlFor="rf-order" className={labelCls}>Orden de apariciÃ³n</label>
          <input id="rf-order" type="text" inputMode="numeric" value={displayOrder} onChange={(e) => setDisplayOrder(e.target.value.replace(/\D/g, "").slice(0, 4))} className={inputCls} />
          <p className={helpCls}>Menor nÃºmero aparece primero.</p>
        </div>
        <div>
          <label htmlFor="rf-terms" className={labelCls}>TÃ©rminos y condiciones del sorteo</label>
          <textarea id="rf-terms" value={terms} onChange={(e) => setTerms(e.target.value)} className={`${inputCls} min-h-24 py-3`} placeholder="Condiciones especÃ­ficas de esta rifa (visibles en su pÃ¡gina)" maxLength={5000} rows={4} />
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
          {saving ? "Guardandoâ€¦" : mode === "create" ? "Crear rifa" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
