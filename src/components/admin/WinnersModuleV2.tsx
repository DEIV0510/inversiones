"use client";

import { useEffect, useRef, useState } from "react";
import { useModalA11y } from "@/components/useModalA11y";
import {
  btnOutline,
  btnPrimary,
  Chip,
  EmptyState,
  helpCls,
  inputCls,
  labelCls,
  LoadingRows,
} from "./ui";
import {
  IconImage,
  IconPencil,
  IconPlus,
  IconTrash,
  IconTrophy,
} from "@/components/icons";

type Winner = {
  id: string;
  raffleId: string | null;
  raffleTitle: string;
  numberValue: number | null;
  numberFormatted: string | null;
  participantId: string | null;
  participantName: string;
  prize: string;
  drawnAtText: string | null;
  photoUrl: string | null;
  isDemo: boolean;
  isPublished: boolean;
  displayOrder: number;
  createdAt: string;
};

type RaffleOption = { id: string; title: string };

export default function WinnersModuleV2() {
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Modal
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const panelRef = useModalA11y(open, () => setOpen(false));

  // Rifas para el select (se cargan al abrir el modal por primera vez)
  const [raffles, setRaffles] = useState<RaffleOption[] | null>(null);

  // Campos del formulario
  const [raffleId, setRaffleId] = useState("");
  const [numberInput, setNumberInput] = useState("");
  const [raffleTitle, setRaffleTitle] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [prize, setPrize] = useState("");
  const [drawnAtText, setDrawnAtText] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [displayOrder, setDisplayOrder] = useState("0");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Recargar la lista = subir la versión; el efecto vuelve a pedir los datos.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchWinners() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/winners");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "No fue posible cargar los ganadores");
          return;
        }
        setWinners(data.winners ?? []);
      } catch {
        if (!cancelled) setError("Error de conexión");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchWinners();
    return () => {
      cancelled = true;
    };
  }, [version]);

  async function loadRaffles() {
    if (raffles !== null) return;
    try {
      const res = await fetch("/api/admin/raffles");
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.raffles)) {
        setRaffles(
          data.raffles.map((r: { id: string; title: string }) => ({
            id: r.id,
            title: r.title,
          }))
        );
      } else {
        setRaffles([]);
      }
    } catch {
      setRaffles([]);
    }
  }

  function openCreate() {
    setEditingId(null);
    setRaffleId("");
    setNumberInput("");
    setRaffleTitle("");
    setParticipantName("");
    setPrize("");
    setDrawnAtText("");
    setPhotoUrl(null);
    setIsDemo(false);
    setIsPublished(false);
    setDisplayOrder("0");
    setFormError("");
    loadRaffles();
    setOpen(true);
  }

  function openEdit(w: Winner) {
    setEditingId(w.id);
    setRaffleId(w.raffleId ?? "");
    setNumberInput(w.numberFormatted ?? "");
    setRaffleTitle(w.raffleTitle);
    setParticipantName(w.participantName);
    setPrize(w.prize);
    setDrawnAtText(w.drawnAtText ?? "");
    setPhotoUrl(w.photoUrl);
    setIsDemo(w.isDemo);
    setIsPublished(w.isPublished);
    setDisplayOrder(String(w.displayOrder));
    setFormError("");
    loadRaffles();
    setOpen(true);
  }

  function onRaffleSelect(id: string) {
    setRaffleId(id);
    if (id) {
      const r = raffles?.find((x) => x.id === id);
      if (r) setRaffleTitle(r.title);
    }
    if (!id) setNumberInput("");
  }

  async function uploadPhoto(file: File) {
    setUploading(true);
    setFormError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error || "No fue posible subir la foto");
        return;
      }
      setPhotoUrl(data.url);
    } catch {
      setFormError("Error de conexión al subir la foto");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        raffleId: raffleId || null,
        raffleTitle: raffleTitle.trim(),
        numberInput: numberInput.trim(),
        participantName: participantName.trim(),
        prize: prize.trim(),
        drawnAtText: drawnAtText.trim(),
        photoUrl,
        isDemo,
        isPublished,
        displayOrder: parseInt(displayOrder || "0", 10) || 0,
      };
      const res = await fetch(
        editingId ? `/api/admin/winners/${editingId}` : "/api/admin/winners",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error || "No fue posible guardar");
        return;
      }
      setOpen(false);
      setVersion((v) => v + 1);
    } catch {
      setFormError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublish(w: Winner) {
    setBusyId(w.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/winners/${w.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !w.isPublished }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible actualizar");
        return;
      }
      setWinners((prev) =>
        prev.map((x) =>
          x.id === w.id ? { ...x, isPublished: !w.isPublished } : x
        )
      );
    } catch {
      setError("Error de conexión");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(w: Winner) {
    if (
      !window.confirm(
        `¿Eliminar al ganador "${w.participantName}"? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setBusyId(w.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/winners/${w.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible eliminar");
        return;
      }
      setWinners((prev) => prev.filter((x) => x.id !== w.id));
    } catch {
      setError("Error de conexión");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <button type="button" onClick={openCreate} className={btnPrimary}>
          <IconPlus width={18} height={18} />
          Registrar ganador
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm font-medium text-error"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <LoadingRows rows={4} />
      ) : winners.length === 0 ? (
        <EmptyState text="Aún no hay ganadores registrados. Usa el botón “Registrar ganador”." />
      ) : (
        winners.map((w) => (
          <article
            key={w.id}
            className="rounded-2xl border border-line bg-card p-4 shadow-card"
          >
            <div className="flex gap-3.5">
              {w.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={w.photoUrl}
                  alt=""
                  className="h-[72px] w-[72px] shrink-0 rounded-xl border border-line object-cover"
                />
              ) : (
                <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl bg-well text-fg-faint">
                  <IconTrophy width={26} height={26} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-base font-extrabold text-fg">
                  {w.participantName}
                </h2>
                <p className="mt-0.5 truncate text-sm text-fg-soft">
                  {w.prize}
                </p>
                <p className="mt-0.5 truncate text-xs text-fg-faint">
                  {w.raffleTitle}
                  {w.numberFormatted ? (
                    <>
                      {" · Número "}
                      <span className="font-mono tabular-nums text-fg-soft">
                        {w.numberFormatted}
                      </span>
                    </>
                  ) : null}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {w.isDemo ? <Chip tone="warn">Demo</Chip> : null}
                  {w.isPublished ? (
                    <Chip tone="ok">Publicado</Chip>
                  ) : (
                    <Chip tone="muted">Oculto</Chip>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => togglePublish(w)}
                disabled={busyId === w.id}
                className={btnOutline}
              >
                {w.isPublished ? "Ocultar" : "Publicar"}
              </button>
              <button
                type="button"
                onClick={() => remove(w)}
                disabled={busyId === w.id}
                className={btnOutline}
              >
                <IconTrash width={15} height={15} />
                Eliminar
              </button>
              <button
                type="button"
                onClick={() => openEdit(w)}
                disabled={busyId === w.id}
                className="glow-brand-sm inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand px-4 text-xs font-bold uppercase tracking-wide text-white hover:bg-brand-dark disabled:opacity-50"
              >
                <IconPencil width={15} height={15} />
                Editar
              </button>
            </div>
          </article>
        ))
      )}

      {/* Modal registrar / editar */}
      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "Editar ganador" : "Registrar ganador"}
          onClick={() => setOpen(false)}
        >
          <div
            ref={panelRef}
            tabIndex={-1}
            className="modal-in max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-card p-6 outline-none sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-extrabold uppercase text-fg">
              {editingId ? "Editar ganador" : "Registrar ganador"}
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              className="mt-4 flex flex-col gap-4"
            >
              <div>
                <label htmlFor="wn-raffle" className={labelCls}>
                  Rifa (opcional)
                </label>
                <select
                  id="wn-raffle"
                  value={raffleId}
                  onChange={(e) => onRaffleSelect(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Sin rifa asociada</option>
                  {(raffles ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
              </div>

              {raffleId ? (
                <div>
                  <label htmlFor="wn-number" className={labelCls}>
                    Número ganador
                  </label>
                  <input
                    id="wn-number"
                    type="text"
                    inputMode="numeric"
                    value={numberInput}
                    onChange={(e) =>
                      setNumberInput(e.target.value.replace(/\D/g, "").slice(0, 8))
                    }
                    className={`${inputCls} font-mono`}
                    placeholder="Ej: 0457"
                    disabled={editingId !== null}
                  />
                  <p className={helpCls}>
                    {editingId
                      ? "El número solo se asigna al crear el registro."
                      : "Si el número ya está vendido, el sistema busca automáticamente a su comprador y ese será el nombre del ganador."}
                  </p>
                </div>
              ) : null}

              <div>
                <label htmlFor="wn-title" className={labelCls}>
                  Nombre de la rifa *
                </label>
                <input
                  id="wn-title"
                  type="text"
                  required
                  value={raffleTitle}
                  onChange={(e) => setRaffleTitle(e.target.value)}
                  className={inputCls}
                  placeholder="Ej: Gran Sorteo Moto 0 KM"
                  maxLength={160}
                />
                <p className={helpCls}>
                  Se llena solo al elegir una rifa, pero puedes editarlo.
                </p>
              </div>

              <div>
                <label htmlFor="wn-name" className={labelCls}>
                  Nombre del ganador *
                </label>
                <input
                  id="wn-name"
                  type="text"
                  required
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  className={inputCls}
                  placeholder="Ej: María Pérez"
                  maxLength={120}
                />
              </div>

              <div>
                <label htmlFor="wn-prize" className={labelCls}>
                  Premio *
                </label>
                <input
                  id="wn-prize"
                  type="text"
                  required
                  value={prize}
                  onChange={(e) => setPrize(e.target.value)}
                  className={inputCls}
                  placeholder="Ej: Motocicleta 0 KM"
                  maxLength={160}
                />
              </div>

              <div>
                <label htmlFor="wn-date" className={labelCls}>
                  Fecha del sorteo (texto)
                </label>
                <input
                  id="wn-date"
                  type="text"
                  value={drawnAtText}
                  onChange={(e) => setDrawnAtText(e.target.value)}
                  className={inputCls}
                  placeholder="Ej: 30 de agosto de 2026"
                  maxLength={120}
                />
              </div>

              <div>
                <p className={labelCls}>Foto (opcional)</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) uploadPhoto(f);
                  }}
                  aria-label="Seleccionar foto del ganador"
                />
                {photoUrl ? (
                  <div className="overflow-hidden rounded-xl border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photoUrl}
                      alt="Foto del ganador"
                      className="aspect-[4/3] w-full object-cover"
                    />
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
                        onClick={() => setPhotoUrl(null)}
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
                    className="flex min-h-24 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line bg-well text-fg-soft transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
                  >
                    <IconImage width={26} height={26} />
                    <span className="text-xs font-bold uppercase tracking-wide">
                      {uploading ? "Subiendo…" : "Subir foto"}
                    </span>
                  </button>
                )}
                <p className={helpCls}>
                  Evidencia de la entrega del premio. Se muestra en el sitio.
                </p>
              </div>

              <div className="flex flex-col gap-1 rounded-xl border border-line bg-well px-4 py-2">
                <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-fg">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-brand"
                  />
                  Publicado en el sitio
                </label>
                <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-fg">
                  <input
                    type="checkbox"
                    checked={isDemo}
                    onChange={(e) => setIsDemo(e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-brand"
                  />
                  Es de demostración (demo)
                </label>
              </div>

              <div>
                <label htmlFor="wn-order" className={labelCls}>
                  Orden de aparición
                </label>
                <input
                  id="wn-order"
                  type="text"
                  inputMode="numeric"
                  value={displayOrder}
                  onChange={(e) =>
                    setDisplayOrder(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  className={inputCls}
                />
                <p className={helpCls}>Menor número aparece primero.</p>
              </div>

              {formError ? (
                <p
                  role="alert"
                  className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm font-medium text-error"
                >
                  {formError}
                </p>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className={btnOutline}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving || uploading}
                  className={btnPrimary}
                >
                  {saving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
