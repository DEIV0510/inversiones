import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import WinnersManager from "@/components/admin/WinnersManager";

export const metadata: Metadata = { title: "Ganadores" };
export const dynamic = "force-dynamic";

export default async function AdminWinnersPage() {
  await requirePanelAuth();
  const winners = await prisma.winner.findMany({
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Ganadores
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Publica aquí a los ganadores de cada sorteo. Solo los marcados como
          “publicado” aparecen en la página.
        </p>
      </div>
      <WinnersManager
        winners={winners.map((w) => ({
          id: w.id,
          name: w.name,
          prize: w.prize,
          raffleTitle: w.raffleTitle,
          photoUrl: w.photoUrl,
          drawnAtText: w.drawnAtText,
          isDemo: w.isDemo,
          isPublished: w.isPublished,
          displayOrder: w.displayOrder,
        }))}
      />
    </div>
  );
}
