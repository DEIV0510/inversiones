import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { confirmOrderPayment } from "@/lib/engine/orders";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import {
  findTransactionByReference,
  isWompiConfigured,
  paymentReference,
  transactionMatchesOrder,
} from "@/lib/wompi";

export const runtime = "nodejs";

/**
 * Verificación de respaldo tras el redirect de la pasarela: consulta la
 * transacción DIRECTAMENTE en Wompi (nunca confía en parámetros del
 * navegador) y confirma la orden si está aprobada.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const ip = clientIp(req);
  if (isRateLimited("orders.verify", ip, { max: 20, windowMs: 60_000, globalMax: 500 })) {
    return NextResponse.json({ error: "Espera un momento" }, { status: 429 });
  }

  const { code } = await params;
  const order = await prisma.order.findUnique({ where: { code } });
  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }
  if (order.status === "PAID") {
    return NextResponse.json({ status: "PAID" });
  }
  if (!isWompiConfigured()) {
    return NextResponse.json({ status: order.status });
  }

  const tx = await findTransactionByReference(paymentReference(code));
  if (tx?.status === "APPROVED" && transactionMatchesOrder(tx, order)) {
    const result = await confirmOrderPayment({
      orderId: order.id,
      provider: "wompi",
      providerTxId: tx.id,
      reference: tx.reference,
      amount: Math.round(tx.amount_in_cents / 100),
      raw: tx,
    });
    if (result.ok) return NextResponse.json({ status: "PAID" });
  }

  const fresh = await prisma.order.findUnique({
    where: { code },
    select: { status: true },
  });
  return NextResponse.json({ status: fresh?.status ?? order.status });
}
