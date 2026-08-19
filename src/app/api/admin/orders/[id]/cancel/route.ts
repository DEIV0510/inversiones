import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminApi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { invalidarEtiquetas, TAG_RIFAS, tagRifaId } from "@/lib/cache-tags";
import { cancelOrder, OrderError } from "@/lib/engine/orders";

export const runtime = "nodejs";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("orders.cancel");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  try {
    const order = await cancelOrder(id);
    await logAudit({
      actorEmail: auth.email,
      actorRole: auth.role,
      action: "order.cancel",
      entity: "Order",
      entityId: id,
      detail: { estado: order.status },
    });

    // Cancelar un pedido pagado devuelve sus números al bombo y baja el
    // PORCENTAJE de la portada cacheada. Se regenera con la transacción del
    // motor ya cerrada; si cancelOrder hubiera lanzado, no se llega aquí.
    revalidatePath("/");
    revalidatePath("/sorteo/[slug]", "page");
    // Y la consulta cacheada de donde sale ese porcentaje, por el id de la
    // rifa de la orden (que es lo único que se conoce aquí).
    invalidarEtiquetas(TAG_RIFAS, tagRifaId(order.raffleId));

    return NextResponse.json({ ok: true, order });
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
