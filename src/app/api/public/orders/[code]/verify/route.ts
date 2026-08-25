import { NextRequest, NextResponse } from "next/server";
import { invalidarEtiquetas, TAG_RIFAS, tagRifaId } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { confirmOrderPayment } from "@/lib/engine/orders";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { pasarelaActiva } from "@/lib/pasarela";
import {
  boldOrderId,
  boldVoucherConfirmaOrden,
  fetchBoldTransaction,
} from "@/lib/bold";
import {
  findTransactionByReference,
  isWompiConfigured,
  paymentReference,
  transactionMatchesOrder,
} from "@/lib/wompi";

export const runtime = "nodejs";

/**
 * Un pago confirmado por esta vía cambia el porcentaje de avance y el ranking
 * de compradores, que son datos CACHEADOS. Antes esta ruta no invalidaba nada
 * (era el único camino de confirmación que no lo hacía), así que el comprador
 * veía sus números al instante pero el resto de la página seguía enseñando
 * las cifras viejas hasta que venciera el plazo de la caché.
 */
function confirmarYRefrescar(raffleId: string): void {
  invalidarEtiquetas(TAG_RIFAS, tagRifaId(raffleId));
}

/**
 * Verificación de respaldo tras el redirect de la pasarela. Nunca confía en
 * parámetros del navegador; según la pasarela consulta a quien corresponda:
 *
 * - WOMPI: consulta la transacción por referencia en su API.
 * - BOLD: consulta el comprobante de la venta por su identificador
 *   (`DYS-<código>`, el mismo que se firmó en el botón).
 *
 * En los dos casos se confirma SOLO con estado aprobado y monto exacto.
 *
 * Esto es un RESPALDO. La vía principal sigue siendo el webhook firmado, que
 * confirma en segundos; la consulta de Bold puede tardar ~10 minutos en
 * reflejar la venta y hasta entonces responde NO_TRANSACTION_FOUND. Pero
 * cuando el webhook no llega —no está registrado, se cayó, Bold no
 * reintentó— este camino es lo único que le queda al comprador para que sus
 * números aparezcan sin que el dueño confirme a mano.
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

  // ── Bold: consulta del comprobante ───────────────────────────────────
  // Una sola referencia: `boldButtonConfig` siempre firma el botón con la
  // base `DYS-<código>` (el sufijo de reintento existe en boldOrderId pero
  // hoy no lo usa nadie). Si algún día se usa, hay que probarlas todas aquí.
  if (porBold) {
    const referencia = boldOrderId(code);
    const voucher = await fetchBoldTransaction(referencia);
    if (boldVoucherConfirmaOrden(voucher, order)) {
      const result = await confirmOrderPayment({
        orderId: order.id,
        provider: "bold",
        // Bold no devuelve payment_id en el comprobante; la referencia ES el
        // identificador único de la venta, así que sirve de idempotencia.
        providerTxId: referencia,
        reference: referencia,
        amount: Math.round(voucher!.total!),
        raw: voucher,
      });
      if (result.ok) {
        confirmarYRefrescar(order.raffleId);
        return NextResponse.json({ status: "PAID" });
      }
    }
  }

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
      if (result.ok) {
        confirmarYRefrescar(order.raffleId);
        return NextResponse.json({ status: "PAID" });
      }
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
