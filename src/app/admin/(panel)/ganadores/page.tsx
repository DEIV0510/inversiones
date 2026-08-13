import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import WinnersModuleV2 from "@/components/admin/WinnersModuleV2";

export const metadata: Metadata = { title: "Ganadores" };
export const dynamic = "force-dynamic";

export default async function AdminGanadoresPage() {
  await requirePanelAuth("winners.manage");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Ganadores
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Registra los ganadores y decide cuáles se publican en el sitio.
        </p>
      </div>
      <WinnersModuleV2 />
    </div>
  );
}
