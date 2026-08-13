import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import ReservationsModule from "@/components/admin/ReservationsModule";

export const metadata: Metadata = { title: "Reservas" };
export const dynamic = "force-dynamic";

export default async function AdminReservationsPage() {
  await requirePanelAuth("reservations.view");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Reservas
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Números apartados que todavía no se han pagado. Al vencerse se
          liberan solos.
        </p>
      </div>

      <ReservationsModule />
    </div>
  );
}
