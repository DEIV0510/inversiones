import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import OrdersModule from "@/components/admin/OrdersModule";

export const metadata: Metadata = { title: "Pedidos" };
export const dynamic = "force-dynamic";

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requirePanelAuth("orders.view");
  const { q } = await searchParams;

  const canConfirm = can(session.role, "orders.confirm");
  const canCancel = can(session.role, "orders.cancel");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Pedidos
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Revisa cada pedido, confirma pagos y libera números.
        </p>
      </div>

      <OrdersModule
        initialQuery={q ?? ""}
        canConfirm={canConfirm}
        canCancel={canCancel}
      />
    </div>
  );
}
