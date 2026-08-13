"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatCop } from "@/lib/format";
import { IconCheck, IconX } from "@/components/icons";
import {
  Chip,
  EmptyState,
  LoadingRows,
  ORDER_STATUS_CHIP,
  Pager,
  btnOutline,
  btnPrimary,
  formatDate,
  inputCls,
} from "./ui";

type OrderRow = {
  id: string;
  code: string;
  raffleTitle: string;
  participant: { name: string; phone: string };
  numbers: string[];
  quantity: number;
  total: number;
  status: string;
  paymentMethod: string | null;
  reservedUntil: string | null;
  paidAt: string | null;
  createdAt: string;
};

type Loaded = {
  key: string;
  items: OrderRow[];
  total: number;
  perPage: number;
  error: string;
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "PENDING", label: "Pendientes" },
  { value: "PAID", label: "Pagados" },
  { value: "EXPIRED", label: "Expirados" },
  { value: "CANCELLED", label: "Cancelados" },
  { value: "REJECTED", label: "En revisión" },
];

const MAX_NUMBERS_VISIBLE = 8;

function methodLabel(method: string | null): string {
  if (!method) return "Sin definir";
  if (method === "wompi") return "Wompi";
  if (method === "whatsapp") return "WhatsApp";
  if (method === "manual") return "Manual";
  return method;
}

export default function OrdersModule({
  initialQuery,
  canConfirm,
  canCancel,
}: {
  initialQuery: string;
  canConfirm: boolean;
  canCancel: boolean;
}) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState(initialQuery);
  const [query, setQuery] = useState(initialQuery);
  const [version, setVersion] = useState(0);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [actionError, setActionError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const requestKey = `${page}|${status}|${query}|${version}`;

  useEffect(() => {
    let alive = true;

    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set("status", status);
    if (query) params.set("q", query);

    fetch(`/api/admin/orders?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "No fue posible cargar los pedidos");
        }
        return data;
      })
      .then((data) => {
        if (!alive) return;
        setLoaded({
          key: requestKey,
          items: data.items ?? [],
          total: data.total ?? 0,
          perPage: data.perPage ?? 25,
          error: "",
        });
      })
      .catch((err) => {
        if (!alive) return;
        setLoaded({
          key: requestKey,
          items: [],
          total: 0,
          perPage: 25,
          error: err instanceof Error ? err.message : "Error de conexión",
        });
      });

    return () => {
      alive = false;
    };
  }, [requestKey, page, status, query]);

  const current = loaded && loaded.key === requestKey ? loaded : null;
  const loading = !current;
  const errorMsg = actionError || current?.error || "";

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setActionError("");
    setPage(1);
    setQuery(search.trim());
  }

  async function confirmPayment(order: OrderRow) {
    if (!window.confirm("¿Confirmar que recibiste el pago de este pedido?")) {
      return;
    }
    setBusyId(order.id);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/confirm`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || "No fue posible confirmar el pago");
        return;
      }
      setVersion((v) => v + 1);
    } catch {
      setActionError("Error de conexión");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelOrder(order: OrderRow) {
    if (
      !window.confirm(
        `¿Cancelar el pedido ${order.code}? Los números vuelven a quedar libres para otra persona.`
      )
    ) {
      return;
    }
    setBusyId(order.id);
    setActionError("");
    try {
      const res = await fetch(`/api/admin/orders/${order.id}/cancel`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || "No fue posible cancelar el pedido");
        return;
      }
      setVersion((v) => v + 1);
    } catch {
      setActionError("Error de conexión");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form
        onSubmit={submitSearch}
        className="flex flex-col gap-2.5 rounded-2xl border border-line bg-card p-4 sm:flex-row"
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código, nombre o teléfono"
          aria-label="Buscar pedidos"
          className={inputCls}
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por estado"
          className={`${inputCls} sm:w-56`}
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button type="submit" className={`${btnPrimary} shrink-0`}>
          Buscar
        </button>
      </form>

      {errorMsg ? (
        <p
          role="alert"
          className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm font-medium text-error"
        >
          {errorMsg}
        </p>
      ) : null}

      {loading ? (
        <LoadingRows rows={5} />
      ) : current.items.length === 0 ? (
        current.error ? null : (
          <EmptyState text="No hay pedidos con estos filtros. Prueba cambiando la búsqueda o el estado." />
        )
      ) : (
        <div className="flex flex-col gap-3">
          {current.items.map((order) => {
            const chip = ORDER_STATUS_CHIP[order.status] ?? {
              text: order.status,
              tone: "muted" as const,
            };
            const visibleNumbers = order.numbers.slice(0, MAX_NUMBERS_VISIBLE);
            const hiddenCount = order.numbers.length - visibleNumbers.length;
            const busy = busyId === order.id;

            return (
              <article
                key={order.id}
                className="rounded-2xl border border-line bg-card p-4 shadow-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base font-extrabold tracking-wide text-fg">
                      {order.code}
                    </p>
                    <p className="mt-0.5 truncate text-sm text-fg-soft">
                      {order.raffleTitle}
                    </p>
                  </div>
                  <Chip tone={chip.tone}>{chip.text}</Chip>
                </div>

                <p className="mt-2 text-sm text-fg">
                  {order.participant.name}
                  <span className="text-fg-soft"> · {order.participant.phone}</span>
                </p>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {visibleNumbers.map((num) => (
                    <span
                      key={num}
                      className="inline-flex rounded-lg bg-well px-2 py-1 text-xs font-bold tabular-nums text-fg"
                    >
                      {num}
                    </span>
                  ))}
                  {hiddenCount > 0 ? (
                    <span className="text-xs font-semibold text-fg-faint">
                      +{hiddenCount} más
                    </span>
                  ) : null}
                </div>

                <p className="mt-2.5 text-sm text-fg">
                  <span className="font-bold tabular-nums">
                    {formatCop(order.total)}
                  </span>
                  <span className="text-fg-soft">
                    {" "}
                    · {order.quantity}{" "}
                    {order.quantity === 1 ? "número" : "números"} ·{" "}
                    {methodLabel(order.paymentMethod)}
                  </span>
                </p>

                <p className="mt-1 text-xs tabular-nums text-fg-faint">
                  Creado {formatDate(order.createdAt)}
                  {order.status === "PENDING" && order.reservedUntil
                    ? ` · Vence ${formatDate(order.reservedUntil)}`
                    : ""}
                  {order.paidAt ? ` · Pagado ${formatDate(order.paidAt)}` : ""}
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
                  <Link
                    href={`/pedido/${order.code}`}
                    target="_blank"
                    className={btnOutline}
                  >
                    Ver
                  </Link>
                  {canCancel &&
                  (order.status === "PENDING" || order.status === "PAID") ? (
                    <button
                      type="button"
                      onClick={() => cancelOrder(order)}
                      disabled={busy}
                      className={btnOutline}
                    >
                      <IconX width={15} height={15} />
                      Cancelar
                    </button>
                  ) : null}
                  {canConfirm && order.status === "PENDING" ? (
                    <button
                      type="button"
                      onClick={() => confirmPayment(order)}
                      disabled={busy}
                      className={`${btnPrimary} min-h-11 px-4 text-xs`}
                    >
                      <IconCheck width={15} height={15} />
                      Confirmar pago
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!loading ? (
        <Pager
          page={page}
          total={current.total}
          perPage={current.perPage}
          onPage={(p) => {
            setActionError("");
            setPage(p);
          }}
        />
      ) : null}
    </div>
  );
}
