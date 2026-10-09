import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import ReservationsModule from "@/components/admin/ReservationsModule";

export const metadata: Metadata = { title: "Reservas" };
export const dynamic = "force-dynamic";

export default async function AdminReservationsPage() {
  const session = await requirePanelAuth("reservations.view");
  // Liberar es cancelar el pedido: mismo permiso que en Pedidos. Se decide
  // aquí para que el botón ni aparezca a quien no puede usarlo.
  const canCancel = can(session.role, "orders.cancel");

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

      <ReservationsModule canCancel={canCancel} />
    </div>
  );
}
