import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import RaffleForm from "@/components/admin/RaffleForm";

export const metadata: Metadata = { title: "Nueva rifa" };
export const dynamic = "force-dynamic";

export default async function NuevaRifaPage() {
  await requirePanelAuth();
  const settings = await getSettings();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Nueva rifa
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Completa la información, revisa la vista previa y publica.
        </p>
      </div>
      <RaffleForm mode="create" whatsappNumber={settings.whatsapp_number} />
    </div>
  );
}
