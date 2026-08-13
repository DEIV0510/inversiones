import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import ParticipantsModule from "@/components/admin/ParticipantsModule";

export const metadata: Metadata = { title: "Participantes" };
export const dynamic = "force-dynamic";

export default async function AdminParticipantsPage() {
  await requirePanelAuth("participants.view");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Participantes
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Compradores registrados y su historial de pedidos
        </p>
      </div>

      <ParticipantsModule />
    </div>
  );
}
