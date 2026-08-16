"use client";

import { useEffect, useState } from "react";
import { IconX } from "@/components/icons";
import {
  EmptyState,
  LoadingRows,
  Pager,
  formatDate,
  inputCls,
  labelCls,
} from "./ui";

type ReservationRow = {
  id: string;
  number: string;
  raffleTitle: string;
  orderCode: string | null;
  participant: { name: string; phone: string } | null;
  createdAt: string;
  reservedUntil: string;
};

type RaffleOption = { id: string; title: string };

type Loaded = {
  key: string;
  items: ReservationRow[];
  total: number;
  perPage: number;
  error: string;
};

/* Lenguaje visual del panel: tarjeta violeta oscura de esquina 2xl. */
const cardCls = "rounded-2xl border border-line bg-card p-4 shadow-card";
/* Aviso de error: rosa sobre violeta, igual en todos los módulos. */
const alertCls =
  "rounded-xl border border-error/35 bg-error/10 px-4 py-3 text-sm font-medium text-error";
/* Acción destructiva: pastilla rosa, la misma de Pedidos. */
const btnDanger =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-error/45 bg-error/10 px-4 text-xs font-bold uppercase tracking-[0.1em] text-error transition-colors hover:bg-error/20 disabled:opacity-50";

export default function ReservationsModule() {
  const [page, setPage] = useState(1);
  const [raffleId, setRaffleId] = useState("");
  const [raffles, setRaffles] = useState<RaffleOption[]>([]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  // Si el servidor contesta 403 se ocultan los botones: este rol solo mira.
  const [puedeLiberar, setPuedeLiberar] = useState(true);

  const requestKey = `${page}|${raffleId}|${version}`;

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/raffles")
      .then((res) => (res.ok ? res.json() : { raffles: [] }))
      .then((data) => {
        if (!alive) return;
        setRaffles(
          (data.raffles ?? []).map((r: { id: string; title: string }) => ({
            id: r.id,
            title: r.title,
          }))
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    const params = new URLSearchParams({ page: String(page) });
    if (raffleId) params.set("raffleId", raffleId);

    fetch(`/api/admin/reservations?${params.toString()}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.error || "No fue posible cargar las reservas");
        }
        return data;
      })
      .then((data) => {
        if (!alive) return;
        setLoaded({
          key: requestKey,
          items: data.items ?? [],
          total: data.total ?? 0,
          perPage: data.perPage ?? 50,
          error: "",
        });
      })
      .catch((err) => {
        if (!alive) return;
        setLoaded({
          key: requestKey,
          items: [],
          total: 0,
          perPage: 50,
          error: err instanceof Error ? err.message : "Error de conexión",
        });
      });

    return () => {
      alive = false;
    };
  }, [requestKey, page, raffleId]);

  const current = loaded && loaded.key === requestKey ? loaded : null;
  const loading = !current;
  const errorMsg = actionError || current?.error || "";

  /**
   * Libera una reserva. Un número reservado pertenece siempre a un pedido, así
   * que liberarlo es cancelar ese pedido completo: se avisa en el aviso previo
   * para que nadie suelte por error los demás números del mismo comprador.
   * Se reutiliza el mismo endpoint de cancelación que usa Pedidos, buscando
   * antes el pedido por su código.
   */
  async function liberar(row: ReservationRow) {
    const codigo = row.orderCode;
    if (!codigo) return;
    if (
      !window.confirm(
        `¿Liberar el número ${row.number}? Se cancela el pedido ${codigo} completo y todos sus números vuelven a quedar libres.`
      )
    ) {
      return;
    }
    setBusyId(row.id);
    setActionError("");
    try {
      const busqueda = await fetch(
        `/api/admin/orders?q=${encodeURIComponent(codigo)}&perPage=10`
      );
      const datos = await busqueda.json().catch(() => ({}));
      if (!busqueda.ok) {
        setActionError(datos.error || "No fue posible encontrar el pedido");
        return;
      }
      const pedido = (datos.items ?? []).find(
        (o: { id: string; code: string }) => o.code === codigo
      );
      if (!pedido) {
        setActionError(`No se encontró el pedido ${codigo}`);
        return;
      }
      const res = await fetch(`/api/admin/orders/${pedido.id}/cancel`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403) setPuedeLiberar(false);
        setActionError(data.error || "No fue posible liberar la reserva");
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
      <div className={cardCls}>
        <label htmlFor="rv-raffle" className={labelCls}>
          Rifa
        </label>
        <select
          id="rv-raffle"
          value={raffleId}
          onChange={(e) => {
            setActionError("");
            setRaffleId(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por rifa"
          className={inputCls}
        >
          <option value="">Todas las rifas</option>
          {raffles.map((raffle) => (
            <option key={raffle.id} value={raffle.id}>
              {raffle.title}
            </option>
          ))}
        </select>
      </div>

      {errorMsg ? (
        <p role="alert" className={alertCls}>
          {errorMsg}
        </p>
      ) : null}

      {loading ? (
        <LoadingRows rows={6} />
      ) : current.items.length === 0 ? (
        current.error ? null : (
          <EmptyState text="No hay reservas activas en este momento." />
        )
      ) : (
        <div className="flex flex-col gap-3">
          {current.items.map((row) => (
            <article key={row.id} className={cardCls}>
              <div className="flex items-start gap-3">
                {/* El número, en fucsia sobre pozo violeta */}
                <span className="flex h-14 min-w-14 shrink-0 items-center justify-center rounded-xl border border-brand/25 bg-brand-deep/20 px-2 font-display text-lg font-black tracking-[0.04em] tabular-nums text-brand-light">
                  {row.number}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">
                      {row.raffleTitle}
                    </p>
                    <span className="inline-flex shrink-0 items-center rounded-full border border-warn/45 bg-warn/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-warn">
                      Reservado
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-fg-soft">
                    {row.participant
                      ? `${row.participant.name} · ${row.participant.phone}`
                      : "Sin participante asociado"}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-fg-faint">
                    {row.orderCode ? (
                      <>
                        Pedido{" "}
                        <span className="font-mono uppercase tracking-[0.08em] text-brand-violet">
                          {row.orderCode}
                        </span>
                        {" · "}
                      </>
                    ) : null}
                    Reservado {formatDate(row.createdAt)} · Expira{" "}
                    {formatDate(row.reservedUntil)}
                  </p>
                </div>
              </div>
              {puedeLiberar && row.orderCode ? (
                <div className="mt-3 flex justify-end border-t border-line pt-3">
                  <button
                    type="button"
                    onClick={() => liberar(row)}
                    disabled={busyId === row.id}
                    className={btnDanger}
                  >
                    <IconX width={15} height={15} />
                    Liberar
                  </button>
                </div>
              ) : null}
            </article>
          ))}
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
