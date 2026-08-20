import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { confirmOrderPayment } from "@/lib/engine/orders";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { pasarelaActiva } from "@/lib/pasarela";
import {
  findTransactionByReference,
  isWompiConfigured,
  paymentReference,
  transactionMatchesOrder,
} from "@/lib/wompi";

export const runtime = "nodejs";

/**
 * Verificación de respaldo tras el redirect de la pasarela. Nunca confía en
 * parámetros del navegador; según la pasarela hace una cosa u otra:
 *
 * - WOMPI: consulta la transacción DIRECTAMENTE en su API por referencia y
 *   confirma la orden si está aprobada y el monto coincide.
 * - BOLD: en la integración del Botón de Pagos, Bold no documenta una
 *   consulta pública equivalente ("dame el estado de la referencia X"), así
 *   que aquí no hay nada legítimo que consultar: la vía de confirmación es su
 *   webhook firmado (/api/webhooks/bold), que llega en segundos. Este
 *   endpoint entonces RELEE el estado de la orden en la base y responde
 *   `esperandoWebhook: true` mientras siga pendiente, para que la pantalla
 *   del pedido pueda volver a preguntar sin inventarse un endpoint que no
 *   existe.
 *
 * En ningún caso se marca pagado por lo que diga el navegador.
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

  // ¿Este pedido pasó por Bold? Si Bold ya dejó rastro (un intento rechazado,
  // o un pago cuyo monto no cuadró), no tiene sentido ir a preguntarle a
  // Wompi por él.
  const intentoBold = await prisma.payment.findFirst({
    where: { orderId: order.id, provider: "bold" },
    select: { id: true },
  });
  const porBold = Boolean(intentoBold) || pasarelaActiva() === "bold";

  if (!intentoBold && isWompiConfigured()) {
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
  }

  const fresh = await prisma.order.findUnique({
    where: { code },
    select: { status: true },
  });
  const status = fresh?.status ?? order.status;
  return NextResponse.json({
    status,
    // Con Bold la confirmación llega por webhook: se le dice a la pantalla que
    // vale la pena volver a preguntar en unos segundos.
    esperandoWebhook: porBold && status === "PENDING",
  });
}
