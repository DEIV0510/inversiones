import Link from "next/link";
import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { progressPctOf } from "@/lib/public";
import RaffleListV2 from "@/components/admin/RaffleListV2";
import { IconPlus } from "@/components/icons";

export const metadata: Metadata = { title: "Sorteos" };
export const dynamic = "force-dynamic";

export default async function AdminRafflesPage() {
  const session = await requirePanelAuth("numbers.view");
  const now = new Date();

  const raffles = await prisma.raffle.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  // Conteos reales por rifa (solo visibles para el admin). Los vendidos
  // salen del contador denormalizado de la rifa; sobre la tabla de números
  // solo se consultan reservas vivas y bloqueos, que son pocos y usan el
  // índice (raffleId, status) sin OR.
  const [reservedGroups, blockedGroups] = await Promise.all([
    prisma.raffleNumber.groupBy({
      by: ["raffleId"],
      _count: { _all: true },
      where: { status: "RESERVED", reservedUntil: { gt: now } },
    }),
    prisma.raffleNumber.groupBy({
      by: ["raffleId"],
      _count: { _all: true },
      where: { status: "BLOCKED" },
    }),
  ]);
  const reservedFor = (raffleId: string) =>
    reservedGroups.find((g) => g.raffleId === raffleId)?._count._all ?? 0;
  const blockedFor = (raffleId: string) =>
    blockedGroups.find((g) => g.raffleId === raffleId)?._count._all ?? 0;

  const canManage = can(session.role, "raffles.manage");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
            Sorteos
          </h1>
          <p className="mt-1 text-sm text-fg-soft">{raffles.length} en total</p>
        </div>
        {canManage ? (
          <Link
            href="/admin/rifas/nueva"
            className="glow-red-sm inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark"
          >
            <IconPlus width={18} height={18} />
            Nueva
          </Link>
        ) : null}
      </div>

      <RaffleListV2
        canManage={canManage}
        raffles={raffles.map((r) => ({
          id: r.id,
          slug: r.slug,
          title: r.title,
          prize: r.prize,
          imageUrl: r.imageUrl,
          status: r.status,
          progressPct: progressPctOf(r),
          progressMode: r.progressMode,
          pricePerNumber: r.pricePerNumber,
          totalNumbers: r.totalNumbers,
          paid: r.paidCount,
          reserved: reservedFor(r.id),
          blocked: blockedFor(r.id),
          displayOrder: r.displayOrder,
        }))}
      />
    </div>
  );
}
