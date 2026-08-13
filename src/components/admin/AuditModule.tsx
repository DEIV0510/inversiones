"use client";

import { useEffect, useState } from "react";
import { ROLE_LABELS } from "@/lib/rbac";
import {
  EmptyState,
  formatDate,
  inputCls,
  labelCls,
  LoadingRows,
  Pager,
} from "./ui";

type AuditItem = {
  id: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId: string | null;
  detailJson: string;
  createdAt: string;
};

const ENTITY_OPTIONS = [
  { value: "", label: "Todas las entidades" },
  { value: "Raffle", label: "Rifas" },
  { value: "Order", label: "Pedidos" },
  { value: "Winner", label: "Ganadores" },
  { value: "AdminUser", label: "Usuarios" },
  { value: "Setting", label: "Configuración" },
];

function prettyDetail(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 1);
  } catch {
    return raw;
  }
}

function roleLabel(role: string): string {
  return (ROLE_LABELS as Record<string, string>)[role] ?? role;
}

export default function AuditModule() {
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(50);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [entity, setEntity] = useState("");
  const [actionInput, setActionInput] = useState("");
  const [action, setAction] = useState("");

  // Debounce del filtro de acción para no pedir en cada tecla.
  useEffect(() => {
    const t = setTimeout(() => {
      setAction(actionInput.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [actionInput]);

  useEffect(() => {
    let cancelled = false;
    async function fetchLogs() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (entity) params.set("entity", entity);
        if (action) params.set("action", action);
        const res = await fetch(`/api/admin/audit?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "No fue posible cargar la auditoría");
          return;
        }
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setPerPage(data.perPage ?? 50);
      } catch {
        if (!cancelled) setError("Error de conexión");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchLogs();
    return () => {
      cancelled = true;
    };
  }, [page, entity, action]);

  return (
    <div className="flex flex-col gap-3">
      {/* Filtros */}
      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-line bg-card p-4 sm:grid-cols-2">
        <div>
          <label htmlFor="au-entity" className={labelCls}>
            Entidad
          </label>
          <select
            id="au-entity"
            value={entity}
            onChange={(e) => {
              setEntity(e.target.value);
              setPage(1);
            }}
            className={inputCls}
          >
            {ENTITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="au-action" className={labelCls}>
            Acción
          </label>
          <input
            id="au-action"
            type="text"
            value={actionInput}
            onChange={(e) => setActionInput(e.target.value)}
            className={inputCls}
            placeholder="Ej: order.confirm"
            maxLength={80}
          />
        </div>
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
        <LoadingRows rows={6} />
      ) : items.length === 0 ? (
        <EmptyState text="No hay registros de auditoría con estos filtros." />
      ) : (
        <>
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-line bg-card p-3.5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-xs tabular-nums text-fg-faint">
                  {formatDate(item.createdAt)}
                </span>
                <span className="min-w-0 truncate text-xs text-fg-soft">
                  {item.actorEmail}{" "}
                  <span className="text-[10px] uppercase tracking-wide text-fg-faint">
                    {roleLabel(item.actorRole)}
                  </span>
                </span>
              </div>
              <p className="mt-1.5 font-mono text-xs text-fg">{item.action}</p>
              <p className="mt-0.5 truncate text-xs text-fg-faint">
                {item.entity}
                {item.entityId ? ` · ${item.entityId}` : ""}
              </p>
              {item.detailJson && item.detailJson !== "{}" ? (
                <details className="mt-1">
                  <summary className="flex min-h-11 cursor-pointer items-center text-xs font-bold uppercase tracking-wide text-fg-soft">
                    Detalle
                  </summary>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-well p-2 text-[11px] text-fg-soft">
                    {prettyDetail(item.detailJson)}
                  </pre>
                </details>
              ) : null}
            </article>
          ))}
          <Pager page={page} total={total} perPage={perPage} onPage={setPage} />
        </>
      )}
    </div>
  );
}
