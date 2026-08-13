import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
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
    return NextResponse.json({ ok: true, order });
  } catch (err) {
    if (err instanceof OrderError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
