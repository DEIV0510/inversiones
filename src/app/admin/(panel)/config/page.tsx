import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import ConfigFormV2 from "@/components/admin/ConfigFormV2";

export const metadata: Metadata = { title: "Configuración" };
export const dynamic = "force-dynamic";

export default async function AdminConfigPage() {
  await requirePanelAuth("settings.manage");
  const settings = await getSettings();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Configuración
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Datos de contacto y redes que ve todo el sitio público.
        </p>
      </div>
      <ConfigFormV2 initial={settings} />
    </div>
  );
}
