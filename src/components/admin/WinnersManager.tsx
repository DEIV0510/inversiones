"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { IconImage, IconPencil, IconPlus, IconTrash, IconTrophy, IconX } from "@/components/icons";

export type AdminWinner = {
  id: string;
  name: string;
  prize: string;
  raffleTitle: string | null;
  photoUrl: string | null;
  drawnAtText: string | null;
  isDemo: boolean;
  isPublished: boolean;
  displayOrder: number;
};

type Props = { winners: AdminWinner[] };

const inputCls =
  "min-h-12 w-full rounded-xl border border-line bg-well px-4 text-base text-fg placeholder:text-fg-soft/50 focus:border-brand focus:outline-none";
const labelCls = "mb-1.5 block text-sm font-semibold text-fg";

const EMPTY_FORM = {
  name: "",
  prize: "",
  raffleTitle: "",
  drawnAtText: "",
  photoUrl: null as string | null,
  isDemo: false,
  isPublished: true,
};

export default function WinnersManager({ winners }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
    setFormOpen(true);
  }

  function openEdit(winner: AdminWinner) {
    setEditingId(winner.id);
    setForm({
      name: winner.name,
      prize: winner.prize,
      raffleTitle: winner.raffleTitle ?? "",
      drawnAtText: winner.drawnAtText ?? "",
      photoUrl: winner.photoUrl,
      isDemo: winner.isDemo,
      isPublished: winner.isPublished,
    });
    setError("");
    setFormOpen(true);
  }

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible subir la foto");
        return;
      }
      setForm((f) => ({ ...f, photoUrl: data.url }));
    } catch {
      setError("Error de conexión al subir la foto");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (form.name.trim().length < 2 || form.prize.trim().length < 2) {
      setError("Completa al menos el nombre y el premio");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      name: form.name.trim(),
      prize: form.prize.trim(),
      raffleTitle: form.raffleTitle.trim(),
      drawnAtText: form.drawnAtText.trim(),
      photoUrl: form.photoUrl,
      isDemo: form.isDemo,
      isPublished: form.isPublished,
    };
    try {
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
        setError(data.error || "No fue posible guardar");
        return;
      }
      setFormOpen(false);
      router.refresh();
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(winner: AdminWinner) {
    setBusyId(winner.id);
    try {
      await fetch(`/api/admin/winners/${winner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !winner.isPublished }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(winner: AdminWinner) {
    if (!window.confirm(`¿Eliminar al ganador "${winner.name}"?`)) return;
    setBusyId(winner.id);
    try {
      await fetch(`/api/admin/winners/${winner.id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={openCreate}
        className="inline-flex min-h-13 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark"
      >
        <IconPlus width={18} height={18} />
        Agregar ganador
      </button>

      {winners.length === 0 && !formOpen ? (
        <p className="rounded-2xl border border-line bg-card p-6 text-sm text-fg-soft">
          Aún no hay ganadores registrados. Cuando realices un sorteo, agrégalo
          aquí para publicarlo en la página.
        </p>
      ) : null}

      {winners.map((winner) => (
        <article
          key={winner.id}
          className="rounded-2xl border border-line bg-card p-4 shadow-card"
        >
          <div className="flex gap-3.5">
            {winner.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={winner.photoUrl}
                alt=""
                className="h-[64px] w-[64px] shrink-0 rounded-xl border border-line object-cover"
              />
            ) : (
              <span className="flex h-[64px] w-[64px] shrink-0 items-center justify-center rounded-xl bg-well text-fg-soft/50">
                <IconTrophy width={24} height={24} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate font-display text-base font-extrabold text-fg">
                {winner.name}
              </h2>
              <p className="truncate text-sm font-semibold text-brand">
                {winner.prize}
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {winner.isDemo ? (
                  <span className="rounded-full bg-well px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Demo
                  </span>
                ) : null}
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    winner.isPublished
                      ? "bg-brand text-white"
                      : "bg-well text-fg-soft"
                  }`}
                >
                  {winner.isPublished ? "Publicado" : "Oculto"}
                </span>
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              role="switch"
              aria-checked={winner.isPublished}
              aria-label={winner.isPublished ? "Ocultar ganador" : "Publicar ganador"}
              disabled={busyId === winner.id}
              onClick={() => togglePublished(winner)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
                winner.isPublished ? "bg-brand" : "bg-line"
              }`}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${
                  winner.isPublished ? "left-6" : "left-1"
                }`}
              />
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => openEdit(winner)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line px-3.5 text-xs font-bold uppercase tracking-wide text-fg transition-colors hover:border-brand hover:text-brand"
              >
                <IconPencil width={15} height={15} />
                Editar
              </button>
              <button
                type="button"
                onClick={() => remove(winner)}
                disabled={busyId === winner.id}
                aria-label="Eliminar ganador"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-line text-fg-soft transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
              >
                <IconTrash width={16} height={16} />
              </button>
            </div>
          </div>
        </article>
      ))}

      {/* Formulario modal */}
      {formOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "Editar ganador" : "Agregar ganador"}
        >
          <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-card p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-extrabold uppercase text-fg">
                {editingId ? "Editar ganador" : "Agregar ganador"}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                aria-label="Cerrar"
                className="flex h-10 w-10 items-center justify-center rounded-xl text-fg-soft hover:bg-well"
              >
                <IconX width={18} height={18} />
              </button>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileChange}
                aria-label="Seleccionar fotografía"
              />
              <div className="flex items-center gap-4">
                {form.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={form.photoUrl}
                    alt="Foto del ganador"
                    className="h-20 w-20 rounded-2xl border border-line object-cover"
                  />
                ) : (
                  <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-well text-fg-soft/50">
                    <IconImage width={28} height={28} />
                  </span>
                )}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line px-4 text-xs font-bold uppercase tracking-wide text-fg transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
                  >
                    {uploading ? "Subiendo…" : form.photoUrl ? "Cambiar foto" : "Subir foto"}
                  </button>
                  {form.photoUrl ? (
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, photoUrl: null }))}
                      className="text-left text-xs font-semibold text-fg-soft underline-offset-2 hover:underline"
                    >
                      Quitar foto
                    </button>
                  ) : null}
                </div>
              </div>

              <div>
                <label htmlFor="w-name" className={labelCls}>
                  Nombre *
                </label>
                <input
                  id="w-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className={inputCls}
                  placeholder="Nombre de la persona ganadora"
                  maxLength={120}
                />
              </div>
              <div>
                <label htmlFor="w-prize" className={labelCls}>
                  Premio *
                </label>
                <input
                  id="w-prize"
                  type="text"
                  value={form.prize}
                  onChange={(e) => setForm((f) => ({ ...f, prize: e.target.value }))}
                  className={inputCls}
                  placeholder="Ej: Motocicleta 0 KM"
                  maxLength={120}
                />
              </div>
              <div>
                <label htmlFor="w-raffle" className={labelCls}>
                  Sorteo
                </label>
                <input
                  id="w-raffle"
                  type="text"
                  value={form.raffleTitle}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, raffleTitle: e.target.value }))
                  }
                  className={inputCls}
                  placeholder="Nombre del sorteo"
                  maxLength={120}
                />
              </div>
              <div>
                <label htmlFor="w-date" className={labelCls}>
                  Fecha
                </label>
                <input
                  id="w-date"
                  type="text"
                  value={form.drawnAtText}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, drawnAtText: e.target.value }))
                  }
                  className={inputCls}
                  placeholder="Ej: 30 de agosto de 2026"
                  maxLength={120}
                />
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-well px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.isDemo}
                  onChange={(e) => setForm((f) => ({ ...f, isDemo: e.target.checked }))}
                  className="h-5 w-5 accent-brand"
                />
                <span className="text-sm font-semibold text-fg">
                  Marcar como ejemplo (DEMO)
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-well px-4 py-3">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, isPublished: e.target.checked }))
                  }
                  className="h-5 w-5 accent-brand"
                />
                <span className="text-sm font-semibold text-fg">
                  Publicar en la página
                </span>
              </label>

              {error ? (
                <p
                  role="alert"
                  className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm font-medium text-brand"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                onClick={save}
                disabled={saving || uploading}
                className="inline-flex min-h-13 items-center justify-center rounded-xl bg-brand px-5 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
