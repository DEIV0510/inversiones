import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import AuditModule from "@/components/admin/AuditModule";

export const metadata: Metadata = { title: "Auditoría" };
export const dynamic = "force-dynamic";

export default async function AdminAuditoriaPage() {
  await requirePanelAuth("audit.view");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Auditoría
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Registro de todas las acciones realizadas en el panel.
        </p>
      </div>
      <AuditModule />
    </div>
  );
}
