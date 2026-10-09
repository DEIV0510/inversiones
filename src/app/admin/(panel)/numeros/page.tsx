import type { Metadata } from "next";
import { requirePanelAuth } from "@/lib/auth";
import { can } from "@/lib/rbac";
import NumbersModule from "@/components/admin/NumbersModule";

export const metadata: Metadata = { title: "Números" };
export const dynamic = "force-dynamic";

export default async function AdminNumbersPage({
  searchParams,
}: {
  // ?rifa= es el enlace del botón "Tablero" del listado; ?raffleId= es el de
  // siempre y se sigue aceptando para no romper enlaces guardados.
  searchParams: Promise<{ rifa?: string; raffleId?: string }>;
}) {
  const session = await requirePanelAuth("numbers.view");
  const { rifa, raffleId } = await searchParams;
  // Mismos permisos que Pedidos: el tablero marca pagos, libera reservas y
  // aparta a mano, y cada botón solo aparece para quien puede usarlo (el API
  // lo vuelve a comprobar de todos modos).
  const canBlock = can(session.role, "numbers.block");
  const canConfirm = can(session.role, "orders.confirm");
  const canCancel = can(session.role, "orders.cancel");

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold uppercase text-fg">
          Números
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Tablero de las rifas de cuadrícula, consulta puntual, números tomados
          y bloqueos por rifa
        </p>
      </div>

      <NumbersModule
        initialRaffleId={rifa ?? raffleId ?? ""}
        canBlock={canBlock}
        canConfirm={canConfirm}
        canCancel={canCancel}
      />
    </div>
  );
}
