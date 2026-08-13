import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
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
  return NextResponse.json({ ok: true, order: result.order });
}
