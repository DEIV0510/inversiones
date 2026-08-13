"use client";

import { useEffect, useState } from "react";
import { formatCop } from "@/lib/format";
import { IconWhatsApp } from "@/components/icons";
import {
  EmptyState,
  LoadingRows,
  Pager,
  btnPrimary,
  formatDate,
  inputCls,
} from "./ui";

type ParticipantRow = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  createdAt: string;
  ordersCount: number;
  paidOrders: number;
  numbersBought: number;
  totalSpent: number;
};

export default function ParticipantsModule() {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ParticipantRow[]>([]);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [listKey, setListKey] = useState(0);

  // Sin setState síncrono dentro del cuerpo del efecto: el estado de carga
  // se activa en los manejadores de eventos que cambian los parámetros.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (query) params.set("q", query);
        const res = await fetch(`/api/admin/participants?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "No fue posible cargar los participantes");
          return;
        }
        setError("");
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setPerPage(data.perPage ?? 25);
      } catch {
        if (!cancelled) setError("Error de conexión");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [page, query, listKey]);

  function submitSearch(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setPage(1);
    setQuery(q.trim());
    setListKey((k) => k + 1);
  }

  function goPage(p: number) {
    setLoading(true);
    setPage(p);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submitSearch} className="flex gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, teléfono o email"
          aria-label="Buscar participante"
          className={inputCls}
        />
        <button type="submit" disabled={loading} className={`${btnPrimary} shrink-0`}>
          Buscar
        </button>
      </form>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm font-medium text-error"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <LoadingRows />
      ) : items.length === 0 ? (
        <EmptyState
          text={
            query
              ? "No se encontraron participantes con esa búsqueda."
              : "Aún no hay participantes registrados."
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((p) => (
            <article
              key={p.id}
              className="rounded-2xl border border-line bg-card p-4 shadow-card"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base font-extrabold text-fg">
                  {p.name}
                </h2>
                <a
                  href={`https://wa.me/${p.phone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold tabular-nums text-wa"
                >
                  <IconWhatsApp width={16} height={16} />
                  {p.phone}
                </a>
              </div>
              <p className="text-xs text-fg-faint">
                {p.email ? `${p.email} · ` : ""}
                Registrado {formatDate(p.createdAt)}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-well px-3 py-2">
                  <p className="text-sm font-bold tabular-nums text-fg">
                    {p.ordersCount.toLocaleString("es-CO")}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-fg-faint">
                    Pedidos
                  </p>
                </div>
                <div className="rounded-xl bg-well px-3 py-2">
                  <p className="text-sm font-bold tabular-nums text-fg">
                    {p.paidOrders.toLocaleString("es-CO")}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-fg-faint">
                    Pagados
                  </p>
                </div>
                <div className="rounded-xl bg-well px-3 py-2">
                  <p className="text-sm font-bold tabular-nums text-fg">
                    {p.numbersBought.toLocaleString("es-CO")}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-fg-faint">
                    Números
                  </p>
                </div>
                <div className="rounded-xl bg-well px-3 py-2">
                  <p className="text-sm font-bold tabular-nums text-fg">
                    {formatCop(p.totalSpent)}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-fg-faint">
                    Total gastado
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Pager page={page} total={total} perPage={perPage} onPage={goPage} />
    </div>
  );
}
