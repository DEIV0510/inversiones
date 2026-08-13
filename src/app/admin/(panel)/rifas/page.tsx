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

  // Conteos reales por rifa (solo visibles para el admin).
  const grouped = await prisma.raffleNumber.groupBy({
    by: ["raffleId", "status"],
    _count: { _all: true },
    where: {
      OR: [
        { status: { in: ["PAID", "BLOCKED"] } },
        { status: "RESERVED", reservedUntil: { gt: now } },
      ],
    },
  });
  const countsFor = (raffleId: string, status: string) =>
    grouped.find((g) => g.raffleId === raffleId && g.status === status)?._count
      ._all ?? 0;

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
          paid: countsFor(r.id, "PAID"),
          reserved: countsFor(r.id, "RESERVED"),
          blocked: countsFor(r.id, "BLOCKED"),
          displayOrder: r.displayOrder,
        }))}
      />
    </div>
  );
}
