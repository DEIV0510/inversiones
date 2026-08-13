import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePanelAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import RaffleFormV2 from "@/components/admin/RaffleFormV2";

export const metadata: Metadata = { title: "Editar rifa" };
export const dynamic = "force-dynamic";

export default async function EditarRifaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePanelAuth("raffles.manage");
  const { id } = await params;

  const raffle = await prisma.raffle.findUnique({ where: { id } });
  if (!raffle) notFound();
  const orderCount = await prisma.order.count({ where: { raffleId: id } });

  let gallery: string[] = [];
  try {
    const parsed = JSON.parse(raffle.galleryJson);
    if (Array.isArray(parsed)) gallery = parsed;
  } catch {
    // galería corrupta → vacía
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Editar rifa
        </h1>
        <p className="mt-1 truncate text-sm text-fg-soft">{raffle.title}</p>
      </div>
      <RaffleFormV2
        mode="edit"
        initial={{
          id: raffle.id,
          slug: raffle.slug,
          title: raffle.title,
          description: raffle.description,
          prize: raffle.prize,
          imageUrl: raffle.imageUrl,
          gallery,
          pricePerNumber: raffle.pricePerNumber,
          totalNumbers: raffle.totalNumbers,
          drawDateText: raffle.drawDateText,
          status: raffle.status,
          progressMode: raffle.progressMode,
          manualProgressPct: raffle.manualProgressPct,
          reservationMinutes: raffle.reservationMinutes,
          maxNumbersPerOrder: raffle.maxNumbersPerOrder,
          terms: raffle.terms,
          displayOrder: raffle.displayOrder,
          hasOrders: orderCount > 0,
        }}
      />
    </div>
  );
}
