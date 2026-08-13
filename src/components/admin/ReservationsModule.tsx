"use client";

import { useEffect, useState } from "react";
import { EmptyState, LoadingRows, Pager, formatDate, inputCls } from "./ui";

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

export default function ReservationsModule() {
  const [page, setPage] = useState(1);
  const [raffleId, setRaffleId] = useState("");
  const [raffles, setRaffles] = useState<RaffleOption[]>([]);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  const requestKey = `${page}|${raffleId}`;

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

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-line bg-card p-4">
        <select
          value={raffleId}
          onChange={(e) => {
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

      {current?.error ? (
        <p
          role="alert"
          className="rounded-xl border border-brand/30 bg-brand/5 px-4 py-3 text-sm font-medium text-error"
        >
          {current.error}
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
            <article
              key={row.id}
              className="rounded-2xl border border-line bg-card p-4 shadow-card"
            >
              <div className="flex items-start gap-3.5">
                <span className="flex h-14 min-w-14 shrink-0 items-center justify-center rounded-xl bg-well px-2 font-display text-lg font-extrabold tabular-nums text-fg">
                  {row.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-fg">
                    {row.raffleTitle}
                  </p>
                  <p className="mt-1 truncate text-sm text-fg-soft">
                    {row.participant
                      ? `${row.participant.name} · ${row.participant.phone}`
                      : "Sin participante asociado"}
                  </p>
                  <p className="mt-1 text-xs tabular-nums text-fg-faint">
                    {row.orderCode ? `Pedido ${row.orderCode} · ` : ""}
                    Reservado {formatDate(row.createdAt)} · Expira{" "}
                    {formatDate(row.reservedUntil)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading ? (
        <Pager
          page={page}
          total={current.total}
          perPage={current.perPage}
          onPage={setPage}
        />
      ) : null}
    </div>
  );
}
