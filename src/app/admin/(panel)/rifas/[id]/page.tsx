import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import RaffleForm from "@/components/admin/RaffleForm";

export const metadata: Metadata = { title: "Editar rifa" };
export const dynamic = "force-dynamic";

export default async function EditarRifaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [raffle, settings] = await Promise.all([
    prisma.raffle.findUnique({ where: { id } }),
    getSettings(),
  ]);
  if (!raffle) notFound();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Editar rifa
        </h1>
        <p className="mt-1 truncate text-sm text-fg-soft">{raffle.title}</p>
      </div>
      <RaffleForm
        mode="edit"
        whatsappNumber={settings.whatsapp_number}
        initial={{
          id: raffle.id,
          title: raffle.title,
          description: raffle.description,
          prize: raffle.prize,
          imageUrl: raffle.imageUrl,
          priceCop: raffle.priceCop,
          drawDateText: raffle.drawDateText,
          progressPct: raffle.progressPct,
          status: raffle.status,
          isPublished: raffle.isPublished,
          displayOrder: raffle.displayOrder,
          totalNumbers: raffle.totalNumbers,
          notes: raffle.notes,
        }}
      />
    </div>
  );
}
