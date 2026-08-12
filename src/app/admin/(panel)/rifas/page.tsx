import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import RaffleAdminCard from "@/components/admin/RaffleAdminCard";
import { IconPlus } from "@/components/icons";

export const metadata: Metadata = { title: "Rifas" };
export const dynamic = "force-dynamic";

export default async function AdminRafflesPage() {
  const raffles = await prisma.raffle.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
            Rifas
          </h1>
          <p className="mt-1 text-sm text-fg-soft">
            {raffles.length} en total
          </p>
        </div>
        <Link
          href="/admin/rifas/nueva"
          className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-brand-dark"
        >
          <IconPlus width={18} height={18} />
          Nueva
        </Link>
      </div>

      {raffles.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card p-6 text-sm text-fg-soft">
          Aún no hay rifas creadas. Toca “Nueva” para crear la primera.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {raffles.map((raffle) => (
            <RaffleAdminCard
              key={raffle.id}
              raffle={{
                id: raffle.id,
                title: raffle.title,
                prize: raffle.prize,
                imageUrl: raffle.imageUrl,
                progressPct: raffle.progressPct,
                status: raffle.status,
                isPublished: raffle.isPublished,
                displayOrder: raffle.displayOrder,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
