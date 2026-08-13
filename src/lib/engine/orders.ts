import { randomInt } from "node:crypto";
import type { Order, Raffle } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeWhatsApp } from "@/lib/whatsapp";
import { validateSelection } from "@/lib/numbers";
import {
  ClaimConflictError,
  claimNumbers,
  pickRandomAvailable,
} from "./claims";

/**
 * Motor de pedidos: creación con reserva atómica, confirmación de pago
 * idempotente, expiración y cancelación. Toda mutación de números pasa por
 * transacciones; el frontend nunca decide disponibilidad.
 */

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O/1/I

export function generateOrderCode(): string {
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)];
  }
  return code;
}

export class OrderError extends Error {
  constructor(
    message: string,
    public status = 422,
    public conflicting: number[] = []
  ) {
    super(message);
    this.name = "OrderError";
  }
}

export type CreateOrderInput = {
  raffleSlug: string;
  name: string;
  phone: string;
  email?: string;
  numbers?: number[];
  randomCount?: number;
};

/** ¿La orden PENDING sigue viva o ya expiró su reserva? */
export function isOrderExpired(order: {
  status: string;
  reservedUntil: Date | null;
}): boolean {
  return (
    order.status === "PENDING" &&
    order.reservedUntil != null &&
    order.reservedUntil < new Date()
  );
}

export async function createOrder(input: CreateOrderInput): Promise<{
  order: Order;
  raffle: Raffle;
  numbers: number[];
}> {
  const raffle = await prisma.raffle.findUnique({
    where: { slug: input.raffleSlug },
  });
  if (!raffle || raffle.status !== "ACTIVE") {
    throw new OrderError("Este sorteo no está disponible en este momento", 404);
  }

  const phone = normalizeWhatsApp(input.phone);
  if (!phone) throw new OrderError("El número de WhatsApp no es válido");
  const name = input.name.trim();
  if (name.length < 2) throw new OrderError("Escribe tu nombre completo");

  const wantsRandom = !input.numbers || input.numbers.length === 0;
  const randomCount = Math.floor(input.randomCount ?? 0);
  if (wantsRandom && (randomCount < 1 || randomCount > raffle.maxNumbersPerOrder)) {
    throw new OrderError(
      `Indica entre 1 y ${raffle.maxNumbersPerOrder} números`
    );
  }

  // Hasta 3 intentos: en aleatorios, un choque de concurrencia se reintenta
  // con candidatos frescos; en selección manual el conflicto se informa.
  let lastConflict: number[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    let numbers: number[];
    if (wantsRandom) {
      numbers = await pickRandomAvailable(raffle, randomCount);
      if (numbers.length < randomCount) {
        throw new OrderError(
          "No hay suficientes números disponibles en este sorteo",
          409
        );
      }
    } else {
      numbers = [...new Set(input.numbers!)].sort((a, b) => a - b);
      const validation = validateSelection(
        numbers,
        raffle.totalNumbers,
        raffle.maxNumbersPerOrder
      );
      if (validation) throw new OrderError(validation);
    }

    const reservedUntil = new Date(
      Date.now() + raffle.reservationMinutes * 60_000
    );

    try {
      const order = await prisma.$transaction(async (tx) => {
        const participant = await tx.participant.upsert({
          where: { phone },
          update: { name, email: input.email?.trim() || undefined },
          create: { phone, name, email: input.email?.trim() || null },
        });

        const created = await tx.order.create({
          data: {
            code: generateOrderCode(),
            raffleId: raffle.id,
            participantId: participant.id,
            numbersJson: JSON.stringify(numbers),
            quantity: numbers.length,
            unitPrice: raffle.pricePerNumber,
            total: numbers.length * raffle.pricePerNumber,
            status: "PENDING",
            reservedUntil,
          },
        });

        await claimNumbers(tx, raffle.id, numbers, created.id, reservedUntil);
        return created;
      });

      return { order, raffle, numbers };
    } catch (err) {
      if (err instanceof ClaimConflictError) {
        lastConflict = err.conflicting;
        if (!wantsRandom) {
          throw new OrderError(
            "Algunos números ya fueron tomados por otra persona",
            409,
            err.conflicting
          );
        }
        continue; // aleatorios: reintentar con otros candidatos
      }
      throw err;
    }
  }

  throw new OrderError(
    "No fue posible reservar los números, intenta de nuevo",
    409,
    lastConflict
  );
}

export type ConfirmResult =
  | { ok: true; order: Order; alreadyPaid: boolean }
  | { ok: false; reason: string };

/**
 * Confirma el pago de una orden. IDEMPOTENTE: puede llamarse varias veces
 * (webhook repetido, verificación por redirect y confirmación manual) sin
 * duplicar efectos. Nunca marca pagado sin verificar la tenencia real de los
 * números.
 */
export async function confirmOrderPayment(params: {
  orderId: string;
  provider: string; // wompi | manual
  providerTxId?: string;
  reference?: string;
  amount?: number;
  raw?: unknown;
}): Promise<ConfirmResult> {
  return prisma.$transaction(async (tx) => {
    // Bloqueo de fila por orden: serializa confirmaciones concurrentes de la
    // MISMA orden (webhook reintentado por la pasarela + confirmación manual).
    // Sin esto, la segunda transacción vería la orden como PENDING, no
    // encontraría reservas que convertir y rechazaría una orden ya pagada
    // borrando sus números vendidos.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${params.orderId} FOR UPDATE`;

    const order = await tx.order.findUnique({
      where: { id: params.orderId },
      include: { raffle: true },
    });
    if (!order) return { ok: false, reason: "Orden no encontrada" };

    if (order.status === "PAID") {
      // Idempotencia: registrar el pago si es una transacción nueva y salir.
      if (params.providerTxId) {
        await tx.payment.upsert({
          where: { providerTxId: params.providerTxId },
          update: { status: "APPROVED" },
          create: {
            orderId: order.id,
            provider: params.provider,
            providerTxId: params.providerTxId,
            reference: params.reference,
            amount: params.amount ?? order.total,
            status: "APPROVED",
            rawJson: JSON.stringify(params.raw ?? {}),
          },
        });
      }
      return { ok: true, order, alreadyPaid: true };
    }

    if (order.status !== "PENDING") {
      return {
        ok: false,
        reason: `La orden está en estado ${order.status} y no puede confirmarse`,
      };
    }

    const numbers: number[] = JSON.parse(order.numbersJson);

    // 1. Convertir las reservas propias en PAID.
    const converted = await tx.raffleNumber.updateMany({
      where: { orderId: order.id, status: "RESERVED" },
      data: { status: "PAID", reservedUntil: null },
    });

    // 2. Si la reserva había expirado y fue limpiada, intentar re-reclamar
    //    los números que sigan libres (el pago llegó tarde pero el número
    //    sigue disponible).
    let recovered = 0;
    if (converted.count < order.quantity) {
      const held = await tx.raffleNumber.findMany({
        where: { orderId: order.id },
        select: { number: true },
      });
      const heldSet = new Set(held.map((r) => r.number));
      const missing = numbers.filter((n) => !heldSet.has(n));
      if (missing.length > 0) {
        await tx.raffleNumber.deleteMany({
          where: {
            raffleId: order.raffleId,
            number: { in: missing },
            status: "RESERVED",
            reservedUntil: { lt: new Date() },
          },
        });
        const reclaim = await tx.raffleNumber.createMany({
          data: missing.map((number) => ({
            raffleId: order.raffleId,
            number,
            status: "PAID" as const,
            orderId: order.id,
          })),
          skipDuplicates: true,
        });
        recovered = reclaim.count;
      }
    }

    const totalHeld = converted.count + recovered;
    if (totalHeld < order.quantity) {
      // Caso crítico: el pago llegó cuando parte de los números ya fueron
      // vendidos a otra persona. NUNCA se duplica un número: la orden queda
      // rechazada para gestión manual (reembolso/reasignación).
      await tx.raffleNumber.deleteMany({ where: { orderId: order.id } });
      await tx.order.update({
        where: { id: order.id },
        data: { status: "REJECTED", paymentMethod: params.provider },
      });
      if (params.providerTxId) {
        await tx.payment.upsert({
          where: { providerTxId: params.providerTxId },
          update: { status: "APPROVED" },
          create: {
            orderId: order.id,
            provider: params.provider,
            providerTxId: params.providerTxId,
            reference: params.reference,
            amount: params.amount ?? order.total,
            status: "APPROVED",
            rawJson: JSON.stringify(params.raw ?? {}),
          },
        });
      }
      await tx.auditLog.create({
        data: {
          actorEmail: "sistema",
          actorRole: "SYSTEM",
          action: "order.payment_after_resell",
          entity: "Order",
          entityId: order.id,
          detailJson: JSON.stringify({
            provider: params.provider,
            providerTxId: params.providerTxId,
            requiereGestionManual: true,
          }),
        },
      });
      return {
        ok: false,
        reason:
          "El pago se recibió pero los números ya no estaban disponibles. Requiere gestión manual.",
      };
    }

    // 3. Confirmar la orden y actualizar el contador atómico de la rifa.
    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentMethod: params.provider,
        reservedUntil: null,
      },
    });

    if (params.providerTxId || params.provider === "manual") {
      await tx.payment.upsert({
        where: {
          providerTxId:
            params.providerTxId ?? `manual-${order.id}`,
        },
        update: { status: "APPROVED" },
        create: {
          orderId: order.id,
          provider: params.provider,
          providerTxId: params.providerTxId ?? `manual-${order.id}`,
          reference: params.reference,
          amount: params.amount ?? order.total,
          status: "APPROVED",
          rawJson: JSON.stringify(params.raw ?? {}),
        },
      });
    }

    const raffle = await tx.raffle.update({
      where: { id: order.raffleId },
      data: { paidCount: { increment: order.quantity } },
    });
    if (
      raffle.paidCount >= raffle.totalNumbers &&
      raffle.status === "ACTIVE"
    ) {
      await tx.raffle.update({
        where: { id: raffle.id },
        data: { status: "SOLD_OUT" },
      });
    }

    return { ok: true, order: updated, alreadyPaid: false };
  });
}

/**
 * Barrido de expiración: marca órdenes PENDING vencidas como EXPIRED y
 * libera sus números. Lo ejecuta el cron y también se invoca de forma
 * oportunista; la corrección NO depende de que corra a tiempo (la
 * liberación perezosa en claimNumbers cubre el intervalo).
 */
export async function expireOverdueOrders(): Promise<number> {
  const now = new Date();
  const overdue = await prisma.order.findMany({
    where: { status: "PENDING", reservedUntil: { lt: now } },
    select: { id: true },
    take: 500,
  });
  if (overdue.length === 0) return 0;
  const ids = overdue.map((o) => o.id);
  await prisma.$transaction([
    prisma.raffleNumber.deleteMany({
      where: { orderId: { in: ids }, status: "RESERVED" },
    }),
    prisma.order.updateMany({
      where: { id: { in: ids }, status: "PENDING" },
      data: { status: "EXPIRED" },
    }),
  ]);
  return ids.length;
}

/** Cancela una orden (admin). Libera números; si estaba pagada, ajusta el contador. */
export async function cancelOrder(orderId: string): Promise<Order> {
  return prisma.$transaction(async (tx) => {
    // Mismo bloqueo por orden que en la confirmación: evita que dos
    // cancelaciones simultáneas descuenten paidCount dos veces, o que una
    // cancelación y una confirmación se pisen.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId} FOR UPDATE`;

    const order = await tx.order.findUnique({ where: { id: orderId } });
    if (!order) throw new OrderError("Orden no encontrada", 404);
    if (order.status === "CANCELLED") return order;

    const wasPaid = order.status === "PAID";
    await tx.raffleNumber.deleteMany({ where: { orderId } });
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED", reservedUntil: null },
    });
    if (wasPaid) {
      await tx.raffle.update({
        where: { id: order.raffleId },
        data: { paidCount: { decrement: order.quantity } },
      });
    }
    return updated;
  });
}
