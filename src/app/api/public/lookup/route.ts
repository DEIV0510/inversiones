import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isOrderExpired } from "@/lib/engine/orders";
import { formatNumbers } from "@/lib/numbers";
import { clientIp, isRateLimited } from "@/lib/rate-limit";
import { lookupSchema } from "@/lib/validation";
import { normalizeWhatsApp } from "@/lib/whatsapp";

export const runtime = "nodejs";

/**
 * MIS BOLETAS. La credencial es la PAREJA teléfono + código de participación
 * (el código de 8 caracteres se entrega solo en el comprobante): nunca se
 * expone información con solo el teléfono. Rate limit estricto contra
 * fuerza bruta.
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  if (
    isRateLimited("lookup", ip, {
      max: 10,
      windowMs: 10 * 60_000,
      globalMax: 200,
    })
  ) {
    return NextResponse.json(
      { error: "Demasiados intentos. Espera unos minutos." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud no válida" }, { status: 400 });
  }

  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos no válidos" },
      { status: 422 }
    );
  }

  const phone = normalizeWhatsApp(parsed.data.phone);
  if (!phone) {
    return NextResponse.json({ error: "Teléfono no válido" }, { status: 422 });
  }

  const order = await prisma.order.findUnique({
    where: { code: parsed.data.code },
    include: { participant: true },
  });
  // Respuesta idéntica si el código no existe o el teléfono no coincide:
  // no se filtra cuál de los dos falló.
  if (!order || order.participant.phone !== phone) {
    return NextResponse.json(
      { error: "No encontramos boletas con esos datos. Verifica el código y el teléfono." },
      { status: 404 }
    );
  }

  const orders = await prisma.order.findMany({
    where: { participantId: order.participantId },
    include: { raffle: { select: { title: true, digits: true, drawDateText: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    participant: { name: order.participant.name },
    orders: orders.map((o) => ({
      code: o.code,
      raffleTitle: o.raffle.title,
      drawDateText: o.raffle.drawDateText,
      numbers: formatNumbers(JSON.parse(o.numbersJson), o.raffle.digits),
      quantity: o.quantity,
      total: o.total,
      status: isOrderExpired(o) ? "EXPIRED" : o.status,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
    })),
  });
}
