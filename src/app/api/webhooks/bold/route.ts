import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { invalidarEtiquetas, TAG_RIFAS, tagRifaId } from "@/lib/cache-tags";
import { prisma } from "@/lib/db";
import { confirmOrderPayment } from "@/lib/engine/orders";
import { logAudit } from "@/lib/audit";
import {
  boldTransactionMatchesOrder,
  orderCodeFromBoldReference,
  verifyBoldWebhook,
  type BoldWebhookEvent,
} from "@/lib/bold";

export const runtime = "nodejs";

/**
 * Webhook de eventos de Bold. La confirmación de una compra ocurre AQUÍ,
 * nunca porque el navegador diga que pagó (el comprador vuelve del redirect
 * sin nada que podamos creerle). Mismo contrato que el webhook de Wompi:
 * firma verificada + monto exacto + confirmación idempotente. Salvo la firma
 * inválida, siempre responde 200 para que Bold no reintente en bucle; los
 * casos anómalos quedan en logs y auditoría.
 *
 * El cuerpo se lee CRUDO (req.text) porque la firma se calcula sobre esos
 * bytes exactos: reserializar el JSON cambiaría un espacio y la tumbaría.
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!verifyBoldWebhook(rawBody, req.headers.get("x-bold-signature"))) {
    console.warn("Webhook Bold con firma inválida");
    return NextResponse.json({ ok: false, reason: "firma" }, { status: 401 });
  }

  let event: BoldWebhookEvent;
  try {
    event = JSON.parse(rawBody) as BoldWebhookEvent;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const data = event.data;
  const paymentId = data?.payment_id;
  const reference = data?.metadata?.reference ?? "";

  // Eventos que no son una venta aprobada o rechazada (VOID_APPROVED,
  // VOID_REJECTED...) se aceptan y se ignoran: Bold ya cumplió avisando y no
  // tiene por qué reintentar.
  if (event.type !== "SALE_APPROVED" && event.type !== "SALE_REJECTED") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const orderCode = orderCodeFromBoldReference(reference);
  if (!orderCode || !paymentId) {
    // Cobros que no salieron de esta plataforma (datáfono, enlaces sueltos).
    return NextResponse.json({ ok: true, ignored: true });
  }

  const order = await prisma.order.findUnique({ where: { code: orderCode } });
  if (!order) {
    console.warn(`Webhook Bold: orden ${orderCode} no existe`);
    return NextResponse.json({ ok: true, ignored: true });
  }

  const total = data?.amount?.total;
  const currency = data?.amount?.currency ?? "COP";

  if (event.type === "SALE_REJECTED") {
    // Registro del intento fallido (la orden sigue PENDING hasta expirar).
    await prisma.payment.upsert({
      where: { providerTxId: paymentId },
      update: { status: "DECLINED" },
      create: {
        orderId: order.id,
        provider: "bold",
        providerTxId: paymentId,
        reference,
        amount: typeof total === "number" ? total : order.total,
        currency,
        status: "DECLINED",
        rawJson: JSON.stringify(data ?? {}),
      },
    });
    return NextResponse.json({ ok: true });
  }

  // ── SALE_APPROVED ──────────────────────────────────────────────────
  // El monto y la moneda deben coincidir EXACTAMENTE con la orden guardada.
  // Lo que decide cuánto vale el pedido es la base de datos, no el webhook.
  if (!boldTransactionMatchesOrder(event, order)) {
    await logAudit({
      actorEmail: "sistema",
      actorRole: "SYSTEM",
      action: "payment.amount_mismatch",
      entity: "Order",
      entityId: order.id,
      detail: {
        pasarela: "bold",
        esperado: order.total,
        recibido: total,
        moneda: currency,
        providerTxId: paymentId,
        requiereGestionManual: true,
      },
    });
    await prisma.payment.upsert({
      where: { providerTxId: paymentId },
      update: { status: "ERROR" },
      create: {
        orderId: order.id,
        provider: "bold",
        providerTxId: paymentId,
        reference,
        amount: typeof total === "number" ? total : 0,
        currency,
        status: "ERROR",
        rawJson: JSON.stringify(data ?? {}),
      },
    });
    return NextResponse.json({ ok: true, ignored: "monto no coincide" });
  }

  const result = await confirmOrderPayment({
    orderId: order.id,
    provider: "bold",
    providerTxId: paymentId,
    reference,
    amount: order.total, // ya verificado idéntico al del evento
    raw: data,
  });

  if (!result.ok) {
    console.error(`Webhook Bold: ${orderCode} → ${result.reason}`);
    // El pago SÍ entró en Bold (venta aprobada, monto y moneda EXACTOS) pero
    // la orden ya no se puede confirmar: expiró, se canceló o sus números se
    // revendieron a otra persona. NO se entregan números —eso sería robárselos
    // a quien ya los pagó— pero el dinero es real, así que se deja rastro
    // VISIBLE para que el dueño lo gestione a mano (reembolso o reasignación).
    // Sin esto, el pago solo quedaba en un console.error del servidor y el
    // dueño podía no enterarse de que recibió una plata que no fulfilló. El
    // caso de reventa ya escribió su propia auditoría y su Payment APPROVED
    // dentro del motor; aquí no se le pisa nada (ver `update: {}` abajo).
    await logAudit({
      actorEmail: "sistema",
      actorRole: "SYSTEM",
      action: "payment.on_unfulfillable_order",
      entity: "Order",
      entityId: order.id,
      detail: {
        pasarela: "bold",
        motivo: result.reason,
        monto: order.total,
        moneda: currency,
        providerTxId: paymentId,
        requiereGestionManual: true,
      },
    });
    // Deja el pago en el panel de Pagos si aún no estaba. `update: {}` no toca
    // un registro previo: el de reventa se creó como APPROVED y no debe
    // reetiquetarse a ERROR.
    await prisma.payment.upsert({
      where: { providerTxId: paymentId },
      update: {},
      create: {
        orderId: order.id,
        provider: "bold",
        providerTxId: paymentId,
        reference,
        amount: order.total,
        currency,
        status: "ERROR",
        rawJson: JSON.stringify(data ?? {}),
      },
    });
    // 200 igual: reintentar no arreglaría nada (orden expirada, cancelada…).
    return NextResponse.json({ ok: true, ignored: result.reason });
  }

  // Un pago confirmado por la pasarela sube el PORCENTAJE de avance igual que
  // uno confirmado a mano en el panel, así que caduca lo mismo: la portada
  // cacheada y las consultas cacheadas de esa rifa. Va después de que el
  // motor haya cerrado su transacción. Si ya estaba pagada (reintento de
  // Bold) también se revalida: es idempotente y cuesta nada.
  revalidatePath("/");
  revalidatePath("/sorteo/[slug]", "page");
  invalidarEtiquetas(TAG_RIFAS, tagRifaId(order.raffleId));

  return NextResponse.json({ ok: true, alreadyPaid: result.alreadyPaid });
}
