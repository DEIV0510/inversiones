import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import PaymentsModule from "@/components/admin/PaymentsModule";

export const metadata: Metadata = { title: "Pagos" };
export const dynamic = "force-dynamic";

export default async function AdminPaymentsPage() {
  await requirePanelAuth("payments.view");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Pagos
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Historial de transacciones registradas, tanto de Wompi como manuales.
        </p>
      </div>

      <PaymentsModule />
    </div>
  );
}
