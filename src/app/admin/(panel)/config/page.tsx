import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import ConfigForm from "@/components/admin/ConfigForm";

export const metadata: Metadata = { title: "Ajustes" };
export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  await requirePanelAuth();
  const settings = await getSettings();
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Ajustes
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Información de contacto y redes que se muestran en la página.
        </p>
      </div>
      <ConfigForm settings={settings} />
    </div>
  );
}
