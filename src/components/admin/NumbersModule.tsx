"use client";

import { useEffect, useState } from "react";
import {
  Chip,
  EmptyState,
  LoadingRows,
  Pager,
  btnOutline,
  btnPrimary,
  formatDate,
  inputCls,
  labelCls,
} from "./ui";

/**
 * Gestión de números a escala: jamás se carga el universo completo.
 * Consulta puntual por número, lista paginada de tomados y bloqueo de rangos.
 */

type RaffleOption = {
  id: string;
  title: string;
  totalNumbers: number;
};

type NumberStatus = "AVAILABLE" | "RESERVED" | "PAID" | "BLOCKED";

type SingleResult = {
  number: string;
  value: number;
  status: NumberStatus;
  reservedUntil: string | null;
  orderCode: string | null;
  participant: { name: string; phone: string } | null;
};

type NumberRow = {
  id: string;
  number: string;
  value: number;
  status: "RESERVED" | "PAID" | "BLOCKED";
  alive: boolean;
  reservedUntil: string | null;
  createdAt: string;
  orderCode: string | null;
  orderStatus: string | null;
  participant: { name: string; phone: string } | null;
};

const STATUS_CHIP: Record<
  NumberStatus,
  { text: string; tone: "ok" | "warn" | "info" | "muted" }
> = {
  AVAILABLE: { text: "Disponible", tone: "ok" },
  RESERVED: { text: "Reservado", tone: "warn" },
  PAID: { text: "Vendido", tone: "info" },
  BLOCKED: { text: "Bloqueado", tone: "muted" },
};

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "RESERVED", label: "Reservados" },
  { value: "PAID", label: "Vendidos" },
  { value: "BLOCKED", label: "Bloqueados" },
];

function rowChip(row: NumberRow) {
  if (row.status === "RESERVED" && !row.alive) {
    return <Chip tone="muted">Expirada</Chip>;
  }
  const meta = STATUS_CHIP[row.status];
  return <Chip tone={meta.tone}>{meta.text}</Chip>;
}

export default function NumbersModule({
  initialRaffleId,
  canBlock,
}: {
  initialRaffleId: string;
  canBlock: boolean;
}) {
  const [raffles, setRaffles] = useState<RaffleOption[]>([]);
  const [loadingRaffles, setLoadingRaffles] = useState(true);
  const [raffleId, setRaffleId] = useState(initialRaffleId);
  const [error, setError] = useState("");

  // Consulta puntual
  const [lookup, setLookup] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [single, setSingle] = useState<SingleResult | null>(null);

  // Lista paginada
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<NumberRow[]>([]);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(50);
  const [loadingList, setLoadingList] = useState(Boolean(initialRaffleId));
  const [listKey, setListKey] = useState(0);

  // Bloqueo
  const [blockFrom, setBlockFrom] = useState("");
  const [blockTo, setBlockTo] = useState("");
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockError, setBlockError] = useState("");
  const [blockMsg, setBlockMsg] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/raffles");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "No fue posible cargar las rifas");
          return;
        }
        const list: RaffleOption[] = data.raffles ?? [];
        setRaffles(list);
        if (!initialRaffleId && list.length === 1) {
          setLoadingList(true);
          setRaffleId(list[0].id);
        }
      } catch {
        if (!cancelled) setError("Error de conexión");
      } finally {
        if (!cancelled) setLoadingRaffles(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialRaffleId]);

  // Sin setState síncrono dentro del cuerpo del efecto: el estado de carga
  // se activa en los manejadores de eventos que cambian los parámetros.
  useEffect(() => {
    if (!raffleId) return;
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ raffleId, page: String(page) });
        if (statusFilter) params.set("status", statusFilter);
        const res = await fetch(`/api/admin/numbers?${params.toString()}`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "No fue posible cargar los números");
          return;
        }
        setError("");
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setPerPage(data.perPage ?? 50);
      } catch {
        if (!cancelled) setError("Error de conexión");
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [raffleId, statusFilter, page, listKey]);

  function selectRaffle(id: string) {
    setLoadingList(Boolean(id));
    setRaffleId(id);
    setPage(1);
    setSingle(null);
    setLookup("");
    setLookupError("");
    setBlockMsg("");
    setBlockError("");
  }

  function selectFilter(value: string) {
    setLoadingList(true);
    setStatusFilter(value);
    setPage(1);
  }

  function goPage(p: number) {
    setLoadingList(true);
    setPage(p);
  }

  function refreshList() {
    setLoadingList(true);
    setListKey((k) => k + 1);
  }

  async function lookupNumber(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!raffleId || lookup.trim() === "") return;
    setLookupBusy(true);
    setLookupError("");
    setSingle(null);
    try {
      const params = new URLSearchParams({ raffleId, n: lookup.trim() });
      const res = await fetch(`/api/admin/numbers?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLookupError(data.error || "No fue posible consultar el número");
        return;
      }
      setSingle(data.single ?? null);
    } catch {
      setLookupError("Error de conexión");
    } finally {
      setLookupBusy(false);
    }
  }

  async function runBlock(action: "block" | "unblock") {
    if (!raffleId) return;
    const from = parseInt(blockFrom, 10);
    if (!Number.isInteger(from) || from < 0) {
      setBlockError("Escribe el número inicial del rango");
      return;
    }
    let to: number | undefined;
    if (blockTo.trim() !== "") {
      to = parseInt(blockTo, 10);
      if (!Number.isInteger(to) || to < 0) {
        setBlockError("El número final no es válido");
        return;
      }
    }
    if (action === "block") {
      const last = to ?? from;
      const label =
        last !== from ? `los números del ${from} al ${last}` : `el número ${from}`;
      if (
        !window.confirm(
          `¿Bloquear ${label} en esta rifa? Los números tomados se omiten.`
        )
      ) {
        return;
      }
    }
    setBlockBusy(true);
    setBlockError("");
    setBlockMsg("");
    try {
      const res = await fetch("/api/admin/numbers/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raffleId,
          from,
          ...(to !== undefined ? { to } : {}),
          action,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBlockError(data.error || "No fue posible completar la operación");
        return;
      }
      setBlockMsg(
        action === "block"
          ? `${data.blocked} bloqueados, ${data.skipped} omitidos por estar tomados`
          : `${data.unblocked} desbloqueados`
      );
      refreshList();
    } catch {
      setBlockError("Error de conexión");
    } finally {
      setBlockBusy(false);
    }
  }

  const singleChip = single ? STATUS_CHIP[single.status] : null;

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm font-medium text-error"
        >
          {error}
        </p>
      ) : null}

      {/* Selector de rifa */}
      <section className="rounded-2xl border border-line bg-card p-4">
        <label htmlFor="numbers-raffle" className={labelCls}>
          Rifa
        </label>
        {loadingRaffles ? (
          <div className="h-12 animate-pulse rounded-xl bg-well" aria-hidden="true" />
        ) : (
          <select
            id="numbers-raffle"
            value={raffleId}
            onChange={(e) => selectRaffle(e.target.value)}
            className={inputCls}
          >
            <option value="">Selecciona una rifa</option>
            {raffles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} · {r.totalNumbers.toLocaleString("es-CO")} números
              </option>
            ))}
          </select>
        )}
      </section>

      {!raffleId ? (
        <EmptyState text="Selecciona una rifa para consultar y gestionar sus números." />
      ) : (
        <>
          {/* Consulta puntual */}
          <section className="rounded-2xl border border-line bg-card p-4">
            <h2 className="font-display text-base font-extrabold uppercase text-fg">
              Consultar un número
            </h2>
            <form onSubmit={lookupNumber} className="mt-3 flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
                placeholder="Ej: 00042"
                aria-label="Número a consultar"
                className={inputCls}
              />
              <button
                type="submit"
                disabled={lookupBusy || lookup.trim() === ""}
                className={`${btnPrimary} shrink-0`}
              >
                Consultar
              </button>
            </form>
            {lookupError ? (
              <p role="alert" className="mt-2 text-sm font-medium text-error">
                {lookupError}
              </p>
            ) : null}
            {single && singleChip ? (
              <div className="mt-3 rounded-xl border border-line bg-well p-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-display text-2xl font-extrabold tabular-nums text-fg">
                    {single.number}
                  </span>
                  <Chip tone={singleChip.tone}>{singleChip.text}</Chip>
                </div>
                {single.participant ? (
                  <p className="mt-2 text-sm text-fg-soft">
                    {single.participant.name} · {single.participant.phone}
                  </p>
                ) : null}
                {single.orderCode ? (
                  <p className="mt-1 text-xs text-fg-faint">
                    Pedido {single.orderCode}
                  </p>
                ) : null}
                {single.status === "RESERVED" && single.reservedUntil ? (
                  <p className="mt-1 text-xs text-fg-faint">
                    Reserva vence {formatDate(single.reservedUntil)}
                  </p>
                ) : null}
              </div>
            ) : null}
          </section>

          {/* Bloqueo de rangos */}
          {canBlock ? (
            <section className="rounded-2xl border border-line bg-card p-4">
              <h2 className="font-display text-base font-extrabold uppercase text-fg">
                Bloquear números
              </h2>
              <p className="mt-1 text-xs text-fg-soft">
                Máximo 1000 números por operación. Solo se bloquean números
                libres: jamás pisa reservas ni ventas.
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="block-from" className={labelCls}>
                    Desde
                  </label>
                  <input
                    id="block-from"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={blockFrom}
                    onChange={(e) => setBlockFrom(e.target.value)}
                    placeholder="Ej: 100"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label htmlFor="block-to" className={labelCls}>
                    Hasta (opcional)
                  </label>
                  <input
                    id="block-to"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={blockTo}
                    onChange={(e) => setBlockTo(e.target.value)}
                    placeholder="Ej: 199"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => runBlock("block")}
                  disabled={blockBusy}
                  className={btnPrimary}
                >
                  Bloquear
                </button>
                <button
                  type="button"
                  onClick={() => runBlock("unblock")}
                  disabled={blockBusy}
                  className={btnOutline}
                >
                  Desbloquear
                </button>
              </div>
              {blockError ? (
                <p role="alert" className="mt-2 text-sm font-medium text-error">
                  {blockError}
                </p>
              ) : null}
              {blockMsg ? (
                <p className="mt-2 text-sm font-medium text-fg-soft">{blockMsg}</p>
              ) : null}
            </section>
          ) : null}

          {/* Lista paginada de números tomados */}
          <section className="rounded-2xl border border-line bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-base font-extrabold uppercase text-fg">
                Números tomados
              </h2>
              <span className="text-xs tabular-nums text-fg-soft">
                {total.toLocaleString("es-CO")} registros
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => selectFilter(f.value)}
                  className={`${btnOutline} ${
                    statusFilter === f.value ? "border-brand text-brand" : ""
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="mt-3">
              {loadingList ? (
                <LoadingRows />
              ) : items.length === 0 ? (
                <EmptyState text="No hay números tomados con este filtro. Los números sin registro están disponibles." />
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map((row) => (
                    <article
                      key={row.id}
                      className="rounded-2xl border border-line bg-well p-4"
                    >
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-display text-lg font-extrabold tabular-nums text-fg">
                          {row.number}
                        </span>
                        {rowChip(row)}
                      </div>
                      {row.participant ? (
                        <p className="mt-1.5 text-sm text-fg-soft">
                          {row.participant.name} · {row.participant.phone}
                          {row.orderCode ? ` · Pedido ${row.orderCode}` : ""}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs tabular-nums text-fg-faint">
                        {row.status === "RESERVED" && row.alive
                          ? `Reserva hasta ${formatDate(row.reservedUntil)} · `
                          : ""}
                        Creado {formatDate(row.createdAt)}
                      </p>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <Pager page={page} total={total} perPage={perPage} onPage={goPage} />
          </section>
        </>
      )}
    </div>
  );
}
