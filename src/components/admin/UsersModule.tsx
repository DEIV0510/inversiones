"use client";

import { useEffect, useState } from "react";
import { ROLE_LABELS } from "@/lib/rbac";
import { useModalA11y } from "@/components/useModalA11y";
import {
  btnOutline,
  btnPrimary,
  EmptyState,
  formatDate,
  helpCls,
  inputCls,
  labelCls,
  LoadingRows,
} from "./ui";
import { IconPencil, IconPlus, IconTrash } from "@/components/icons";

type AdminUserRow = {
  id: string;
  email: string;
  name: string;
  role: keyof typeof ROLE_LABELS;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

/* Lenguaje visual del panel: tarjeta violeta oscura de esquina 2xl. */
const cardCls = "rounded-2xl border border-line bg-card p-4 shadow-card";
/* Aviso de error: rosa sobre violeta, igual en todos los módulos. */
const alertCls =
  "rounded-xl border border-error/35 bg-error/10 px-4 py-3 text-sm font-medium text-error";
/* Panel del modal: mismo pozo de las tarjetas, hoja inferior en móvil. */
const modalPanelCls =
  "modal-in max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl border border-line bg-card p-6 outline-none sm:rounded-3xl";
/* Fichas: verde activo, rosa inactivo, fucsia para el rol con más poder. */
const TAG_TONES = {
  ok: "border-wa/45 bg-wa/12 text-wa",
  warn: "border-warn/45 bg-warn/12 text-warn",
  bad: "border-error/45 bg-error/10 text-error",
  info: "border-brand/45 bg-brand/15 text-brand-light",
  muted: "border-line-strong bg-well text-fg-faint",
} as const;

function Tag({
  tone = "muted",
  children,
}: {
  tone?: keyof typeof TAG_TONES;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${TAG_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

const ROLES = Object.keys(ROLE_LABELS) as (keyof typeof ROLE_LABELS)[];

export default function UsersModule({ selfId }: { selfId: string }) {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Modal
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const panelRef = useModalA11y(open, () => setOpen(false));

  // Campos del formulario
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<keyof typeof ROLE_LABELS>("ADMIN");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Recargar la lista = subir la versión; el efecto vuelve a pedir los datos.
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function fetchUsers() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/admin/users");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "No fue posible cargar los usuarios");
          return;
        }
        setUsers(data.users ?? []);
      } catch {
        if (!cancelled) setError("Error de conexión");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchUsers();
    return () => {
      cancelled = true;
    };
  }, [version]);

  function openCreate() {
    setEditingId(null);
    setEmail("");
    setName("");
    setPassword("");
    setRole("ADMIN");
    setIsActive(true);
    setFormError("");
    setOpen(true);
  }

  function openEdit(u: AdminUserRow) {
    setEditingId(u.id);
    setEmail(u.email);
    setName(u.name);
    setPassword("");
    setRole(u.role);
    setIsActive(u.isActive);
    setFormError("");
    setOpen(true);
  }

  async function save() {
    setFormError("");
    setSaving(true);
    try {
      const payload = {
        email: email.trim().toLowerCase(),
        name: name.trim(),
        role,
        isActive,
        ...(password ? { password } : {}),
      };
      const res = await fetch(
        editingId ? `/api/admin/users/${editingId}` : "/api/admin/users",
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

  async function toggleActive(u: AdminUserRow) {
    setBusyId(u.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible actualizar");
        return;
      }
      setUsers((prev) =>
        prev.map((x) => (x.id === u.id ? { ...x, isActive: !u.isActive } : x))
      );
    } catch {
      setError("Error de conexión");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(u: AdminUserRow) {
    if (
      !window.confirm(
        `¿Eliminar la cuenta de "${u.name}" (${u.email})? Esta acción no se puede deshacer.`
      )
    ) {
      return;
    }
    setBusyId(u.id);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${u.id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "No fue posible eliminar");
        return;
      }
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
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
          Nuevo usuario
        </button>
      </div>

      {error ? (
        <p role="alert" className={alertCls}>
          {error}
        </p>
      ) : null}

      {loading ? (
        <LoadingRows rows={3} />
      ) : users.length === 0 ? (
        <EmptyState text="No hay usuarios registrados." />
      ) : (
        users.map((u) => (
          <article key={u.id} className={cardCls}>
            <div className="min-w-0">
              <h2 className="truncate font-display text-lg font-extrabold leading-tight text-fg">
                {u.name}
                {u.id === selfId ? (
                  <span className="ml-2 text-xs font-semibold normal-case text-fg-faint">
                    (tú)
                  </span>
                ) : null}
              </h2>
              <p className="mt-0.5 truncate text-sm text-fg-soft">{u.email}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <Tag tone={u.role === "SUPER_ADMIN" ? "info" : "muted"}>
                  {ROLE_LABELS[u.role] ?? u.role}
                </Tag>
                {u.isActive ? (
                  <Tag tone="ok">Activo</Tag>
                ) : (
                  <Tag tone="bad">Inactivo</Tag>
                )}
              </div>
              <p className="mt-2 text-xs tabular-nums text-fg-faint">
                Último acceso: {formatDate(u.lastLoginAt)}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
              {/* Nadie puede desactivarse ni borrarse a sí mismo: el servidor
                  lo rechaza, así que esos botones ni se pintan en tu ficha. */}
              {u.id !== selfId ? (
                <>
                  <button
                    type="button"
                    onClick={() => toggleActive(u)}
                    disabled={busyId === u.id}
                    className={btnOutline}
                  >
                    {u.isActive ? "Desactivar" : "Activar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(u)}
                    disabled={busyId === u.id}
                    className={btnOutline}
                  >
                    <IconTrash width={15} height={15} />
                    Eliminar
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => openEdit(u)}
                disabled={busyId === u.id}
                className={`${btnPrimary} min-h-11 px-4 text-xs`}
              >
                <IconPencil width={15} height={15} />
                Editar
              </button>
            </div>
          </article>
        ))
      )}

      {/* Modal crear / editar */}
      {open ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label={editingId ? "Editar usuario" : "Nuevo usuario"}
          onClick={() => setOpen(false)}
        >
          <div
            ref={panelRef}
            tabIndex={-1}
            className={modalPanelCls}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-extrabold uppercase tracking-[0.02em] text-fg">
              {editingId ? "Editar usuario" : "Nuevo usuario"}
            </h2>
            <span
              aria-hidden="true"
              className="mt-3 block h-px w-full bg-line"
            />

            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
              className="mt-4 flex flex-col gap-4"
            >
              <div>
                <label htmlFor="us-email" className={labelCls}>
                  Correo *
                </label>
                <input
                  id="us-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="correo@ejemplo.com"
                  maxLength={200}
                />
              </div>

              <div>
                <label htmlFor="us-name" className={labelCls}>
                  Nombre *
                </label>
                <input
                  id="us-name"
                  type="text"
                  required
                  minLength={2}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputCls}
                  placeholder="Nombre y apellido"
                  maxLength={120}
                />
              </div>

              <div>
                <label htmlFor="us-pass" className={labelCls}>
                  Contraseña {editingId ? "" : "*"}
                </label>
                <input
                  id="us-pass"
                  type="password"
                  required={!editingId}
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  placeholder={editingId ? "••••••••••" : "Mínimo 10 caracteres"}
                  maxLength={200}
                  autoComplete="new-password"
                />
                <p className={helpCls}>
                  {editingId
                    ? "Déjala vacía para no cambiarla. Mínimo 10 caracteres."
                    : "Mínimo 10 caracteres."}
                </p>
              </div>

              <div>
                <label htmlFor="us-role" className={labelCls}>
                  Rol *
                </label>
                <select
                  id="us-role"
                  value={role}
                  onChange={(e) =>
                    setRole(e.target.value as keyof typeof ROLE_LABELS)
                  }
                  className={inputCls}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_LABELS[r]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="rounded-xl border border-line bg-well px-4 py-1">
                <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-fg">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-5 w-5 shrink-0 accent-brand"
                  />
                  Cuenta activa
                </label>
              </div>

              {formError ? (
                <p role="alert" className={alertCls}>
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
                <button type="submit" disabled={saving} className={btnPrimary}>
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
