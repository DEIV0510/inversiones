import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { invalidarEtiquetas, TAG_RIFAS, tagRifaId } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { confirmOrderPayment } from "@/lib/engine/orders";
import { logAudit } from "@/lib/audit";
import { transactionMatchesOrder, verifyEventSignature } from "@/lib/wompi";

export const runtime = "nodejs";

/**
 * Webhook de eventos de Wompi. La confirmación de una compra ocurre AQUÍ
 * (o en la verificación de respaldo contra el API de Wompi), nunca porque
 * el navegador diga que pagó. Firma verificada + confirmación idempotente:
 * eventos repetidos no duplican efectos. Siempre responde 200 para evitar
 * reintentos infinitos; los casos anómalos quedan en logs/auditoría.
 */
export async function POST(req: NextRequest) {
  let event: Parameters<typeof verifyEventSignature>[0];
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (!verifyEventSignature(event)) {
    console.warn("Webhook Wompi con firma inválida");
    return NextResponse.json({ ok: false, reason: "firma" }, { status: 401 });
  }

  const tx = event.data?.transaction;
  if (!tx?.reference?.startsWith("DYS-")) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const orderCode = tx.reference.slice(4);
  const order = await prisma.order.findUnique({ where: { code: orderCode } });
  if (!order) {
    console.warn(`Webhook Wompi: orden ${orderCode} no existe`);
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (tx.status === "APPROVED") {
    // El monto y la moneda deben coincidir EXACTAMENTE con la orden.
    if (!transactionMatchesOrder(tx, order)) {
      await logAudit({
        actorEmail: "sistema",
        actorRole: "SYSTEM",
        action: "payment.amount_mismatch",
        entity: "Order",
        entityId: order.id,
        detail: {
          esperado: order.total,
          recibido: Math.round(tx.amount_in_cents / 100),
          moneda: tx.currency,
          providerTxId: tx.id,
          requiereGestionManual: true,
        },
      });
      await prisma.payment.upsert({
        where: { providerTxId: tx.id },
        update: { status: "ERROR" },
        create: {
          orderId: order.id,
          provider: "wompi",
          providerTxId: tx.id,
          reference: tx.reference,
          amount: Math.round(tx.amount_in_cents / 100),
          currency: tx.currency,
          status: "ERROR",
          rawJson: JSON.stringify(tx),
        },
      });
      return NextResponse.json({ ok: true, ignored: "monto no coincide" });
    }

    const result = await confirmOrderPayment({
      orderId: order.id,
      provider: "wompi",
      providerTxId: tx.id,
      reference: tx.reference,
      amount: Math.round(tx.amount_in_cents / 100),
      raw: tx,
    });
    if (!result.ok) {
      console.error(`Webhook Wompi: ${orderCode} → ${result.reason}`);
    } else {
      // Un pago confirmado por la pasarela sube el PORCENTAJE de avance
      // igual que uno confirmado a mano en el panel, así que caduca lo
      // mismo: la portada cacheada y las consultas cacheadas de esa rifa.
      // Va después de que el motor haya cerrado su transacción y solo si el
      // pago se confirmó de verdad.
      revalidatePath("/");
      revalidatePath("/sorteo/[slug]", "page");
      invalidarEtiquetas(TAG_RIFAS, tagRifaId(order.raffleId));
    }
  } else if (["DECLINED", "VOIDED", "ERROR"].includes(tx.status)) {
    // Registro del intento fallido (la orden sigue PENDING hasta expirar).
    await prisma.payment.upsert({
      where: { providerTxId: tx.id },
      update: { status: tx.status },
      create: {
        orderId: order.id,
        provider: "wompi",
        providerTxId: tx.id,
        reference: tx.reference,
        amount: Math.round(tx.amount_in_cents / 100),
        status: tx.status,
        rawJson: JSON.stringify(tx),
      },
    });
  }

  return NextResponse.json({ ok: true });
}
