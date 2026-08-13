import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCop } from "@/lib/format";

export const metadata: Metadata = { title: "Reportes" };
export const dynamic = "force-dynamic";

// Réplica de btnOutline (ui.tsx es "use client"; esta página es 100% server).
const exportLinkCls =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 text-xs font-bold uppercase tracking-wide text-fg transition-colors hover:border-brand hover:text-brand";

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendientes",
  PAID: "Pagados",
  EXPIRED: "Expirados",
  CANCELLED: "Cancelados",
  REJECTED: "En revisión",
};

export default async function AdminReportsPage() {
  await requirePanelAuth("reports.view");
  const now = new Date();

  const [
    incomeAgg,
    ordersByStatus,
    participantCount,
    soldTotal,
    raffles,
    soldByRaffle,
    reservedByRaffle,
    incomeByRaffle,
  ] = await Promise.all([
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { total: true } }),
    prisma.order.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.participant.count(),
    prisma.raffleNumber.count({ where: { status: "PAID" } }),
    prisma.raffle.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.raffleNumber.groupBy({
      by: ["raffleId"],
      _count: { _all: true },
      where: { status: "PAID" },
    }),
    prisma.raffleNumber.groupBy({
      by: ["raffleId"],
      _count: { _all: true },
      where: { status: "RESERVED", reservedUntil: { gt: now } },
    }),
    prisma.order.groupBy({
      by: ["raffleId"],
      _sum: { total: true },
      where: { status: "PAID" },
    }),
  ]);

  const income = incomeAgg._sum.total ?? 0;
  const ordersTotal = ordersByStatus.reduce((s, g) => s + g._count._all, 0);
  const ordersOf = (status: string) =>
    ordersByStatus.find((g) => g.status === status)?._count._all ?? 0;
  const soldOf = (raffleId: string) =>
    soldByRaffle.find((g) => g.raffleId === raffleId)?._count._all ?? 0;
  const reservedOf = (raffleId: string) =>
    reservedByRaffle.find((g) => g.raffleId === raffleId)?._count._all ?? 0;
  const incomeOf = (raffleId: string) =>
    incomeByRaffle.find((g) => g.raffleId === raffleId)?._sum.total ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Reportes
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Cifras reales de ventas: solo visibles en el panel
        </p>
      </div>

      {/* Totales generales */}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="font-display text-xl font-extrabold tabular-nums text-brand">
            {formatCop(income)}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-fg-faint">
            Ingresos confirmados
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="font-display text-xl font-extrabold tabular-nums text-fg">
            {soldTotal.toLocaleString("es-CO")}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-fg-faint">
            Números vendidos
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="font-display text-xl font-extrabold tabular-nums text-fg">
            {participantCount.toLocaleString("es-CO")}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-fg-faint">
            Participantes
          </p>
        </div>
        <div className="rounded-2xl border border-line bg-card p-4">
          <p className="font-display text-xl font-extrabold tabular-nums text-fg">
            {ordersTotal.toLocaleString("es-CO")}
          </p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-fg-faint">
            Pedidos totales
          </p>
        </div>
      </section>

      {/* Pedidos por estado */}
      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-base font-extrabold uppercase text-fg">
          Pedidos por estado
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {Object.entries(ORDER_STATUS_LABELS).map(([status, label]) => (
            <div
              key={status}
              className="flex min-h-11 items-center justify-between rounded-xl bg-well px-4"
            >
              <span className="text-sm font-semibold text-fg-soft">{label}</span>
              <span className="text-sm font-bold tabular-nums text-fg">
                {ordersOf(status).toLocaleString("es-CO")}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Por rifa */}
      <section className="flex flex-col gap-3">
        <h2 className="font-display text-base font-extrabold uppercase text-fg">
          Por rifa
        </h2>
        {raffles.length === 0 ? (
          <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-fg-soft">
            Aún no hay rifas para reportar.
          </p>
        ) : (
          raffles.map((r) => {
            const sold = soldOf(r.id);
            const pct =
              r.totalNumbers > 0
                ? Math.round((sold / r.totalNumbers) * 1000) / 10
                : 0;
            return (
              <article
                key={r.id}
                className="rounded-2xl border border-line bg-card p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-display text-base font-extrabold text-fg">
                    {r.title}
                  </h3>
                  <span className="text-xs font-bold tabular-nums text-brand">
                    {pct}% vendido
                  </span>
                </div>
                <div
                  className="mt-2 h-1.5 overflow-hidden rounded-full bg-well"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="rounded-xl bg-well px-3 py-2">
                    <p className="text-sm font-bold tabular-nums text-fg">
                      {sold.toLocaleString("es-CO")}
                      <span className="font-normal text-fg-faint">
                        {" "}
                        / {r.totalNumbers.toLocaleString("es-CO")}
                      </span>
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-fg-faint">
                      Vendidos
                    </p>
                  </div>
                  <div className="rounded-xl bg-well px-3 py-2">
                    <p className="text-sm font-bold tabular-nums text-fg">
                      {reservedOf(r.id).toLocaleString("es-CO")}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-fg-faint">
                      Reservas vivas
                    </p>
                  </div>
                  <div className="rounded-xl bg-well px-3 py-2">
                    <p className="text-sm font-bold tabular-nums text-fg">
                      {formatCop(incomeOf(r.id))}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wide text-fg-faint">
                      Ingresos
                    </p>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </section>

      {/* Exportar */}
      <section className="rounded-2xl border border-line bg-card p-4">
        <h2 className="font-display text-base font-extrabold uppercase text-fg">
          Exportar
        </h2>
        <p className="mt-1 text-xs text-fg-soft">
          Descarga pedidos en CSV (máximo 10.000 registros por archivo).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/api/admin/reports/export" className={exportLinkCls}>
            Todos los pedidos (CSV)
          </a>
          <a href="/api/admin/reports/export?status=PAID" className={exportLinkCls}>
            Solo pagados (CSV)
          </a>
          {raffles.map((r) => (
            <a
              key={r.id}
              href={`/api/admin/reports/export?raffleId=${r.id}`}
              className={exportLinkCls}
            >
              {r.title} (CSV)
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
