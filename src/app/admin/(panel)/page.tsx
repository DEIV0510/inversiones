import Link from "next/link";
import { requirePanelAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCop } from "@/lib/format";
import { can } from "@/lib/rbac";
import { IconPlus, IconTicket, IconUsers } from "@/components/icons";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("es-CO", {
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
});

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  PAID: "Pagada",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
  REJECTED: "Revisión",
};

export default async function AdminDashboard() {
  const session = await requirePanelAuth("dashboard.view");
  const now = new Date();
  const since14 = new Date(now.getTime() - 14 * 86_400_000);

  const [
    activeRaffles,
    finishedRaffles,
    participants,
    paidOrders,
    revenueAgg,
    reservedAlive,
    soldNumbers,
    recentOrders,
    dailyPaid,
  ] = await Promise.all([
    prisma.raffle.count({ where: { status: "ACTIVE" } }),
    prisma.raffle.count({ where: { status: "FINISHED" } }),
    prisma.participant.count(),
    prisma.order.count({ where: { status: "PAID" } }),
    prisma.order.aggregate({ where: { status: "PAID" }, _sum: { total: true } }),
    prisma.raffleNumber.count({
      where: { status: "RESERVED", reservedUntil: { gt: now } },
    }),
    prisma.raffleNumber.count({ where: { status: "PAID" } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        participant: { select: { name: true } },
        raffle: { select: { title: true } },
      },
    }),
    prisma.order.findMany({
      where: { status: "PAID", paidAt: { gte: since14 } },
      select: { paidAt: true, total: true },
    }),
  ]);

  // Ingresos por día (últimos 14 días) para la gráfica.
  const days: { label: string; total: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const key = d.toISOString().slice(0, 10);
    const total = dailyPaid
      .filter((o) => o.paidAt && o.paidAt.toISOString().slice(0, 10) === key)
      .reduce((s, o) => s + o.total, 0);
    days.push({ label: `${d.getDate()}`, total });
  }
  const maxDay = Math.max(1, ...days.map((d) => d.total));

  const stats = [
    { label: "Rifas activas", value: String(activeRaffles), accent: true },
    { label: "Finalizadas", value: String(finishedRaffles) },
    { label: "Participantes", value: String(participants) },
    { label: "Ventas (pedidos)", value: String(paidOrders) },
    { label: "Números vendidos", value: String(soldNumbers) },
    { label: "Reservas activas", value: String(reservedAlive) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Hola, {session.name}
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Resumen de la operación en tiempo real.
        </p>
      </div>

      {/* Ingresos */}
      <div className="neon-card rounded-2xl bg-card p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-fg-faint">
          Ingresos confirmados
        </p>
        <p className="mt-1 font-display text-3xl font-black tabular-nums text-fg">
          {formatCop(revenueAgg._sum.total ?? 0)}
        </p>
        <div className="mt-4 flex h-20 items-end gap-1" aria-label="Ingresos últimos 14 días">
          {days.map((d, i) => (
            <div
              key={i}
              className="group relative flex-1 rounded-t-sm bg-brand/70 transition-colors hover:bg-brand"
              style={{ height: `${Math.max(3, (d.total / maxDay) * 100)}%` }}
              title={`Día ${d.label}: ${formatCop(d.total)}`}
            />
          ))}
        </div>
        <p className="mt-1 text-[10px] text-fg-faint">Últimos 14 días</p>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className={`rounded-2xl p-4 ${
              s.accent
                ? "glow-red-sm bg-brand text-white"
                : "border border-line bg-card"
            }`}
          >
            <p
              className={`font-display text-2xl font-black tabular-nums ${s.accent ? "" : "text-fg"}`}
            >
              {s.value}
            </p>
            <p
              className={`mt-0.5 text-[10px] font-bold uppercase tracking-wide ${
                s.accent ? "text-white/85" : "text-fg-soft"
              }`}
            >
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {can(session.role, "raffles.manage") ? (
          <Link
            href="/admin/rifas/nueva"
            className="glow-red-sm inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold uppercase tracking-wide text-white hover:bg-brand-dark"
          >
            <IconPlus width={17} height={17} />
            Crear rifa
          </Link>
        ) : null}
        <Link
          href="/admin/pedidos"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-bold uppercase tracking-wide text-fg hover:border-brand hover:text-brand"
        >
          <IconTicket width={17} height={17} />
          Pedidos
        </Link>
        <Link
          href="/admin/participantes"
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-card px-4 text-sm font-bold uppercase tracking-wide text-fg hover:border-brand hover:text-brand"
        >
          <IconUsers width={17} height={17} />
          Participantes
        </Link>
      </div>

      {/* Operaciones recientes */}
      <section>
        <h2 className="font-display text-sm font-extrabold uppercase tracking-wide text-fg-soft">
          Operaciones recientes
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {recentOrders.length === 0 ? (
            <p className="rounded-2xl border border-line bg-card p-5 text-sm text-fg-soft">
              Aún no hay pedidos. Cuando alguien participe, aparecerá aquí.
            </p>
          ) : (
            recentOrders.map((o) => (
              <Link
                key={o.id}
                href={`/admin/pedidos?q=${o.code}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-brand"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-fg">
                    {o.participant.name}
                    <span className="ml-2 font-normal text-fg-faint">
                      {o.code}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-fg-soft">
                    {o.raffle.title} · {o.quantity} números ·{" "}
                    {dateFmt.format(o.createdAt)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-display text-sm font-black tabular-nums text-fg">
                    {formatCop(o.total)}
                  </p>
                  <p
                    className={`text-[10px] font-bold uppercase ${
                      o.status === "PAID" ? "text-wa" : "text-fg-faint"
                    }`}
                  >
                    {STATUS_LABEL[o.status] ?? o.status}
                  </p>
                </div>
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
