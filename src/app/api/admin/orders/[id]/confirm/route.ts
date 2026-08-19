import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { requireAdminApi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { invalidarEtiquetas, TAG_RIFAS, tagRifaId } from "@/lib/cache-tags";
import { confirmOrderPayment } from "@/lib/engine/orders";

export const runtime = "nodejs";

/**
 * Confirmación MANUAL de pago (transferencia/Nequi verificada por el
 * administrador). Pasa por el mismo motor idempotente que el webhook.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi("orders.confirm");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const result = await confirmOrderPayment({ orderId: id, provider: "manual" });

  await logAudit({
    actorEmail: auth.email,
    actorRole: auth.role,
    action: "order.confirm_manual",
    entity: "Order",
    entityId: id,
    detail: result.ok ? { ok: true } : { error: result.reason },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 409 });
  }

  // Confirmar un pago sube los números vendidos y con ellos el PORCENTAJE de
  // avance que sale en la portada cacheada. Se regenera aquí, con la
  // transacción del motor ya cerrada y solo si el pago se confirmó de verdad.
  revalidatePath("/");
  revalidatePath("/sorteo/[slug]", "page");
  // Y la consulta cacheada de donde sale ese porcentaje. Aquí solo se conoce
  // el id de la rifa (la orden no lleva el slug), así que se tira del
  // paraguas: cubre la rifa por slug, el listado y los números premiados.
  invalidarEtiquetas(TAG_RIFAS, tagRifaId(result.order.raffleId));

  return NextResponse.json({ ok: true, order: result.order });
}
