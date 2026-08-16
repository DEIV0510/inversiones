"use client";

import { useEffect, useState } from "react";
import {
  EmptyState,
  LoadingRows,
  Pager,
  btnOutline,
  btnPrimary,
  formatDate,
  helpCls,
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

/* Lenguaje visual del panel: tarjeta violeta oscura de esquina 2xl. */
const cardCls = "rounded-2xl border border-line bg-card p-4 shadow-card";
/* Aviso de error: rosa sobre violeta, igual en todos los módulos. */
const alertCls =
  "rounded-xl border border-error/35 bg-error/10 px-4 py-3 text-sm font-medium text-error";
/* Fichas de estado: verde libre, ámbar reservado, fucsia vendido, gris resto. */
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

/* Epígrafe de bloque: mayúsculas violetas con una línea que llena el ancho,
   igual que los formularios de la referencia. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-violet">
        {children}
      </h2>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </div>
  );
}

const STATUS_CHIP: Record<
  NumberStatus,
  { text: string; tone: keyof typeof TAG_TONES }
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
    return <Tag tone="muted">Expirada</Tag>;
  }
  const meta = STATUS_CHIP[row.status];
  return <Tag tone={meta.tone}>{meta.text}</Tag>;
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
  // Bloqueo desde la ficha de consulta puntual (un solo número).
  const [singleBusy, setSingleBusy] = useState(false);

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
          // Vaciar la lista: si falla, no se pueden seguir mostrando los
          // números de la rifa anterior bajo el mensaje de error.
          setItems([]);
          setTotal(0);
          setError(data.error || "No fue posible cargar los números");
          return;
        }
        setError("");
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setPerPage(data.perPage ?? 50);
      } catch {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
          setError("Error de conexión");
        }
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

  /**
   * Vuelve a consultar un número que ya se está mostrando en la ficha de
   * consulta puntual. Se usa después de bloquear o desbloquear: sin esto la
   * ficha seguiría diciendo "Disponible" para un número recién bloqueado.
   */
  async function refreshSingle(value: number) {
    try {
      const params = new URLSearchParams({ raffleId, n: String(value) });
      const res = await fetch(`/api/admin/numbers?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.single) setSingle(data.single);
    } catch {
      // Silencioso: el estado real se sigue viendo en la lista de abajo.
    }
  }

  /**
   * Única llamada al endpoint de bloqueo. La comparten el rango de abajo y el
   * botón de la ficha de consulta, para que las dos vías hagan exactamente lo
   * mismo y solo cambie dónde se enseña el resultado.
   */
  async function enviarBloqueo(
    action: "block" | "unblock",
    from: number,
    to?: number
  ): Promise<
    | { error: string }
    | { data: { blocked?: number; skipped?: number; unblocked?: number } }
  > {
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
        return { error: data.error || "No fue posible completar la operación" };
      }
      return { data };
    } catch {
      return { error: "Error de conexión" };
    }
  }

  /**
   * Bloquea o libera el número que se acaba de consultar, sin obligar al dueño
   * a volver a teclearlo en el rango de abajo. La ficha se refresca sola, así
   * que el propio chip de estado sirve de confirmación.
   */
  async function cambiarNumeroConsultado(action: "block" | "unblock") {
    if (!single || singleBusy) return;
    if (
      action === "block" &&
      !window.confirm(`¿Bloquear el número ${single.number} en esta rifa?`)
    ) {
      return;
    }
    setSingleBusy(true);
    setLookupError("");
    const resultado = await enviarBloqueo(action, single.value);
    if ("error" in resultado) {
      setLookupError(resultado.error);
    } else {
      await refreshSingle(single.value);
      refreshList();
    }
    setSingleBusy(false);
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
    const resultado = await enviarBloqueo(action, from, to);
    if ("error" in resultado) {
      setBlockError(resultado.error);
      setBlockBusy(false);
      return;
    }
    const data = resultado.data;
    setBlockMsg(
      action === "block"
        ? `${data.blocked} bloqueados, ${data.skipped} omitidos por estar tomados`
        : `${data.unblocked} desbloqueados`
    );
    refreshList();
    // Si el número que muestra la ficha de arriba entra en el rango que
    // acaba de cambiar, se refresca para que no quede mostrando lo viejo.
    const afectado = to ?? from;
    if (single && single.value >= from && single.value <= afectado) {
      await refreshSingle(single.value);
    }
    setBlockBusy(false);
  }

  const singleChip = single ? STATUS_CHIP[single.status] : null;

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <p role="alert" className={alertCls}>
          {error}
        </p>
      ) : null}

      {/* Selector de rifa */}
      <section className={cardCls}>
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
          <section className={cardCls}>
            <SectionTitle>Consultar un número</SectionTitle>
            <form onSubmit={lookupNumber} className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={lookup}
                onChange={(e) => setLookup(e.target.value)}
                placeholder="Ej: 00042"
                aria-label="Número a consultar"
                className={`${inputCls} min-w-0 font-mono tabular-nums`}
              />
              <button
                type="submit"
                disabled={lookupBusy || lookup.trim() === ""}
                className={`${btnPrimary} shrink-0 px-5`}
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
              <div className="mt-3 rounded-xl border border-brand/25 bg-brand-deep/20 p-4">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-display text-2xl font-black tracking-[0.06em] tabular-nums text-brand-light">
                    {single.number}
                  </span>
                  <Tag tone={singleChip.tone}>{singleChip.text}</Tag>
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
                {/* Bloquear o liberar aquí mismo: sin volver a teclear el
                    número en el rango de abajo. */}
                {canBlock && single.status === "AVAILABLE" ? (
                  <button
                    type="button"
                    onClick={() => cambiarNumeroConsultado("block")}
                    disabled={singleBusy}
                    className={`${btnOutline} mt-3`}
                  >
                    Bloquear este número
                  </button>
                ) : null}
                {canBlock && single.status === "BLOCKED" ? (
                  <button
                    type="button"
                    onClick={() => cambiarNumeroConsultado("unblock")}
                    disabled={singleBusy}
                    className={`${btnOutline} mt-3`}
                  >
                    Desbloquear este número
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>

          {/* Bloqueo de rangos */}
          {canBlock ? (
            <section className={cardCls}>
              <SectionTitle>Bloquear números</SectionTitle>
              <p className={helpCls}>
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
                    className={`${inputCls} font-mono tabular-nums`}
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
                    className={`${inputCls} font-mono tabular-nums`}
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
                <p role="alert" className={`mt-3 ${alertCls}`}>
                  {blockError}
                </p>
              ) : null}
              {blockMsg ? (
                <p className="mt-3 rounded-xl border border-wa/35 bg-wa/10 px-4 py-3 text-sm font-medium text-wa">
                  {blockMsg}
                </p>
              ) : null}
            </section>
          ) : null}

          {/* Lista paginada de números tomados */}
          <section className={cardCls}>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-violet">
                Números tomados
              </h2>
              <span aria-hidden="true" className="h-px flex-1 bg-line" />
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] tabular-nums text-fg-faint">
                {total.toLocaleString("es-CO")} registros
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => selectFilter(f.value)}
                  aria-pressed={statusFilter === f.value}
                  className={`${btnOutline} ${
                    statusFilter === f.value
                      ? "glow-brand-sm border-brand/60 bg-brand/15 text-brand"
                      : ""
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
                        <span className="font-display text-lg font-black tracking-[0.06em] tabular-nums text-brand-light">
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
