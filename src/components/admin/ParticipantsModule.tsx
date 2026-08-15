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

/* Lenguaje visual del panel: tarjeta violeta oscura de esquina 2xl. */
const cardCls = "rounded-2xl border border-line bg-card p-4 shadow-card";
/* Aviso de error: rosa sobre violeta, igual en todos los módulos. */
const alertCls =
  "rounded-xl border border-error/35 bg-error/10 px-4 py-3 text-sm font-medium text-error";
/* Casilla de cifra: pozo con el dato arriba y su etiqueta en mayúsculas. */
const statBoxCls = "rounded-xl border border-line bg-well px-3 py-2.5";
const statLabelCls =
  "mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-fg-faint";

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
      <form
        onSubmit={submitSearch}
        className={`${cardCls} flex flex-col gap-2.5 sm:flex-row`}
      >
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre, teléfono o email"
          aria-label="Buscar participante"
          className={`${inputCls} min-w-0`}
        />
        <button
          type="submit"
          disabled={loading}
          className={`${btnPrimary} shrink-0 px-5`}
        >
          Buscar
        </button>
      </form>

      {error ? (
        <p role="alert" className={alertCls}>
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
            <article key={p.id} className={cardCls}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="min-w-0 truncate font-display text-lg font-extrabold leading-tight text-fg">
                  {p.name}
                </h2>
                <a
                  href={`https://wa.me/${p.phone}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-wa/45 bg-wa/12 px-3.5 font-mono text-sm font-bold tabular-nums text-wa transition-colors hover:bg-wa/20"
                >
                  <IconWhatsApp width={16} height={16} />
                  {p.phone}
                </a>
              </div>
              <p className="mt-1 truncate text-xs text-fg-faint">
                {p.email ? `${p.email} · ` : ""}
                Registrado {formatDate(p.createdAt)}
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className={statBoxCls}>
                  <p className="font-display text-base font-extrabold tabular-nums text-fg">
                    {p.ordersCount.toLocaleString("es-CO")}
                  </p>
                  <p className={statLabelCls}>Pedidos</p>
                </div>
                <div className={statBoxCls}>
                  <p className="font-display text-base font-extrabold tabular-nums text-fg">
                    {p.paidOrders.toLocaleString("es-CO")}
                  </p>
                  <p className={statLabelCls}>Pagados</p>
                </div>
                <div className={statBoxCls}>
                  <p className="font-display text-base font-extrabold tabular-nums text-brand-light">
                    {p.numbersBought.toLocaleString("es-CO")}
                  </p>
                  <p className={statLabelCls}>Números</p>
                </div>
                <div className={statBoxCls}>
                  {/* brand-light (no brand) para que el texto pequeño cumpla AA */}
                  <p className="font-display text-base font-extrabold tabular-nums text-brand-light">
                    {formatCop(p.totalSpent)}
                  </p>
                  <p className={statLabelCls}>Total gastado</p>
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
