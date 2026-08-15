"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatCop } from "@/lib/format";
import { IconCheck, IconTicket, IconX } from "@/components/icons";
import {
  EmptyState,
  LoadingRows,
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

/* Lenguaje visual del panel: tarjeta violeta oscura de esquina 2xl. */
const cardCls = "rounded-2xl border border-line bg-card p-4 shadow-card";
/* Aviso de error: rosa sobre violeta, igual en todos los módulos. */
const alertCls =
  "rounded-xl border border-error/35 bg-error/10 px-4 py-3 text-sm font-medium text-error";
/* Fichas de estado: verde pagado, ámbar en espera, rosa cancelado, gris resto. */
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
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] ${TAG_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

/* Acción de aprobación: pastilla verde, como la referencia. */
const btnOk =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-wa/45 bg-wa/12 px-4 text-xs font-bold uppercase tracking-[0.1em] text-wa transition-colors hover:bg-wa/20 disabled:opacity-50";
/* Acción destructiva: pastilla rosa. */
const btnDanger =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-error/45 bg-error/10 px-4 text-xs font-bold uppercase tracking-[0.1em] text-error transition-colors hover:bg-error/20 disabled:opacity-50";

const STATUS_OPTIONS = [
  { value: "", label: "Todos los estados" },
  { value: "PENDING", label: "Pendientes" },
  { value: "PAID", label: "Pagados" },
  { value: "EXPIRED", label: "Expirados" },
  { value: "CANCELLED", label: "Cancelados" },
  { value: "REJECTED", label: "En revisión" },
];

/* Mismos textos de siempre; solo se fija el color de cada estado. */
const STATUS_TAG: Record<string, { text: string; tone: keyof typeof TAG_TONES }> =
  {
    PENDING: { text: "Pendiente", tone: "warn" },
    PAID: { text: "Pagada", tone: "ok" },
    EXPIRED: { text: "Expirada", tone: "muted" },
    CANCELLED: { text: "Cancelada", tone: "bad" },
    REJECTED: { text: "En revisión", tone: "bad" },
  };

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
        className={`${cardCls} flex flex-col gap-2.5 sm:flex-row`}
      >
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por código, nombre o teléfono"
          aria-label="Buscar pedidos"
          className={`${inputCls} min-w-0`}
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
        <button type="submit" className={`${btnPrimary} shrink-0 px-5`}>
          Buscar
        </button>
      </form>

      {errorMsg ? (
        <p role="alert" className={alertCls}>
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
            const tag = STATUS_TAG[order.status] ?? {
              text: order.status,
              tone: "muted" as const,
            };
            const visibleNumbers = order.numbers.slice(0, MAX_NUMBERS_VISIBLE);
            const hiddenCount = order.numbers.length - visibleNumbers.length;
            const busy = busyId === order.id;

            return (
              <article key={order.id} className={cardCls}>
                {/* Cabecera: nombre grande y estado, como la referencia */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-extrabold leading-tight text-fg">
                      {order.participant.name}
                    </p>
                    <p className="mt-1 font-mono text-sm tabular-nums text-fg-soft">
                      {order.participant.phone}
                    </p>
                  </div>
                  <Tag tone={tag.tone}>{tag.text}</Tag>
                </div>

                <p className="mt-1.5 truncate text-xs text-fg-faint">
                  <span className="font-mono uppercase tracking-[0.08em] text-brand-violet">
                    {order.code}
                  </span>{" "}
                  · {order.raffleTitle}
                </p>

                {/* Números comprados: pozo violeta con las cifras en fucsia */}
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-brand/25 bg-brand-deep/20 px-3 py-2.5">
                  <IconTicket
                    width={16}
                    height={16}
                    className="mt-0.5 shrink-0 text-brand"
                  />
                  <p className="min-w-0 break-words font-mono text-sm font-bold leading-relaxed tracking-[0.04em] tabular-nums text-brand-light">
                    {visibleNumbers.join(", ")}
                    {hiddenCount > 0 ? (
                      <span className="font-body text-xs font-semibold tracking-normal text-fg-faint">
                        {" "}
                        +{hiddenCount} más
                      </span>
                    ) : null}
                  </p>
                </div>

                {/* Importe grande en fucsia + medio de pago y cantidad */}
                <div className="mt-3 flex flex-wrap items-center gap-2.5">
                  <p className="font-display text-2xl font-black leading-none tabular-nums text-brand">
                    {formatCop(order.total)}
                  </p>
                  <Tag tone="info">{methodLabel(order.paymentMethod)}</Tag>
                  <Tag tone="muted">
                    {order.quantity}{" "}
                    {order.quantity === 1 ? "número" : "números"}
                  </Tag>
                </div>

                <p className="mt-2 text-xs tabular-nums text-fg-faint">
                  Creado {formatDate(order.createdAt)}
                  {order.status === "PENDING" && order.reservedUntil
                    ? ` · Vence ${formatDate(order.reservedUntil)}`
                    : ""}
                  {order.paidAt ? ` · Pagado ${formatDate(order.paidAt)}` : ""}
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-line pt-3">
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
                      className={btnDanger}
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
                      className={btnOk}
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
