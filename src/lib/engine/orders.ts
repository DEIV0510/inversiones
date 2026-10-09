import { randomInt } from "node:crypto";
import { after } from "next/server";
import type { Order, Raffle } from "@prisma/client";
import { prisma } from "@/lib/db";
import { normalizeWhatsApp } from "@/lib/whatsapp";
import { formatNumbers, validateSelection } from "@/lib/numbers";
import { correoConfigurado, enviarBoletas, type BoletasCorreo } from "@/lib/email";
import { parseTicketPacks } from "@/lib/public";
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
  /** Celular. Solo se usa —y se exige— si la rifa lo pide (askPhone). */
  phone?: string;
  /** Correo. Solo se guarda si la rifa lo pide (askEmail); siempre opcional. */
  email?: string;
  /** Cédula. Solo se usa —y se exige— si la rifa la pide (askIdNumber). */
  idNumber?: string;
  /** Ciudad o municipio. Solo se guarda si la rifa la pide (askCity). */
  city?: string;
  numbers?: number[];
  randomCount?: number;
};

/**
 * Cédula del comprador. Se guarda solo con dígitos para que la búsqueda
 * posterior no dependa de puntos ni espacios. Devuelve undefined si viene
 * vacía o demasiado corta; quien la exige (createOrder, según la rifa) decide
 * qué hacer con eso.
 */
function normalizarCedula(valor?: string): string | undefined {
  const digitos = (valor ?? "").replace(/\D/g, "").slice(0, 15);
  return digitos.length >= 5 ? digitos : undefined;
}

/**
 * ¿La rifa pide este dato? Un valor AUSENTE cuenta como "sí": si por lo que
 * sea la rifa llegara sin la configuración (una fila vieja, un objeto de
 * prueba), se cae del lado estricto —el de la rifa grande, que pide celular y
 * cédula— y nunca del lado de aceptar un pedido sin identificar.
 */
function pide(campo: boolean | null | undefined): boolean {
  return campo !== false;
}

/**
 * Datos del comprador, decididos con la configuración de la rifa.
 *
 * Este es EL sitio donde se exige el celular y la cédula: el esquema del API
 * los deja opcionales porque no sabe de qué rifa es el pedido. Un dato que la
 * rifa NO pide se descarta aunque venga en la petición: así nadie puede, por
 * ejemplo, colar un celular en una rifa de cuadrícula y quedar fundido con el
 * participante de ese número (el upsert por celular le cambiaría el nombre).
 */
export function datosDelComprador(
  raffle: Pick<
    Raffle,
    "askPhone" | "askIdNumber" | "askEmail" | "askCity" | "whatsappCheckout"
  >,
  input: Pick<CreateOrderInput, "phone" | "email" | "idNumber" | "city">
): { phone: string | null; email?: string; cedula?: string; city?: string } {
  let phone: string | null = null;
  if (pide(raffle.askPhone)) {
    const crudo = (input.phone ?? "").trim();
    if (!crudo) {
      throw new OrderError(
        raffle.whatsappCheckout
          ? "Escribe tu número de WhatsApp"
          : "Escribe tu número de teléfono"
      );
    }
    phone = normalizeWhatsApp(crudo);
    // El mensaje no nombra WhatsApp: hay rifas que no cierran por ahí y este
    // texto se le muestra tal cual al comprador.
    if (!phone) throw new OrderError("El número de teléfono no es válido");
  }

  let cedula: string | undefined;
  if (pide(raffle.askIdNumber)) {
    cedula = normalizarCedula(input.idNumber);
    if (!cedula) {
      throw new OrderError("Escribe tu cédula (entre 5 y 15 dígitos)");
    }
  }

  return {
    phone,
    cedula,
    email: pide(raffle.askEmail) ? input.email?.trim() || undefined : undefined,
    city: pide(raffle.askCity) ? input.city?.trim() || undefined : undefined,
  };
}

/**
 * Cuánto se cobra por una cantidad de números.
 *
 * EL DINERO LO DECIDE EL SERVIDOR. El descuento sale SIEMPRE de la rifa
 * guardada en la base (ticketPacksJson); nada de lo que mande el navegador
 * participa en el precio, porque si no cualquiera pediría 100 números con un
 * "descuento" del 90% escrito a mano en la petición.
 *
 * El descuento se aplica cuando la cantidad pedida coincide EXACTAMENTE con
 * la de un paquete que lo tenga: 55 números al 10% cuestan menos, 54 y 56 se
 * pagan a precio de lista. Si por un descuido del panel hubiera dos paquetes
 * con la misma cantidad, gana el de mayor descuento: el comprador nunca paga
 * de más por un error de configuración ajeno.
 *
 * DECISIÓN sobre los números elegidos a mano: el descuento SÍ se aplica
 * también ahí. El paquete es una condición de precio por cantidad ("55
 * números con 10% de descuento"), no un modo de compra; a quien escoge sus
 * 55 números uno por uno se le cobra lo mismo que a quien pulsa el botón del
 * paquete. Cobrarle más sería castigarlo por usar una función que la misma
 * página le ofrece, y el dueño estaría vendiendo dos precios para lo mismo.
 */
export function calcularTotalPedido(params: {
  cantidad: number;
  pricePerNumber: number;
  ticketPacksJson: string;
}): { total: number; discountPct: number } {
  const bruto = params.cantidad * params.pricePerNumber;

  let discountPct = 0;
  for (const pack of parseTicketPacks(params.ticketPacksJson)) {
    if (pack.qty === params.cantidad && pack.discountPct > discountPct) {
      discountPct = pack.discountPct;
    }
  }
  if (discountPct <= 0) return { total: bruto, discountPct: 0 };

  // Math.round y no floor ni ceil: en Colombia el total se cobra en pesos
  // enteros (la pasarela recibe centavos, pero el comprobante y el arqueo del
  // dueño van en pesos), así que hay que quitar los decimales sí o sí y el
  // redondeo al peso más cercano es el que menos se aleja del porcentaje
  // anunciado: el error nunca pasa de medio peso, ni a favor ni en contra.
  const total = Math.round((bruto * (100 - discountPct)) / 100);
  return { total, discountPct };
}

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

  const name = input.name.trim();
  if (name.length < 2) throw new OrderError("Escribe tu nombre completo");
  const { phone, cedula, email, city } = datosDelComprador(raffle, input);

  // Cómo se nombra la operación al comprador. En la cuadrícula se RESERVA
  // —lo pidió el dueño: "la gente es recelosa con comprar"— y en la rifa
  // grande se compra, como siempre.
  const operacion = raffle.boardMode ? "reserva" : "compra";

  const wantsRandom = !input.numbers || input.numbers.length === 0;
  // En la cuadrícula el comprador escoge sus números en el tablero, siempre.
  // El servidor no puede fiarse de que el navegador no mande una cantidad al
  // azar: esos números se escribirían luego en el mensaje de WhatsApp y en la
  // pantalla del pedido, y se verían antes de pagar.
  if (raffle.boardMode && wantsRandom) {
    throw new OrderError("Escoge tus números en el tablero");
  }
  const randomCount = Math.floor(input.randomCount ?? 0);
  if (wantsRandom && (randomCount < 1 || randomCount > raffle.maxNumbersPerOrder)) {
    throw new OrderError(
      `Indica entre 1 y ${raffle.maxNumbersPerOrder} números`
    );
  }

  // Compra mínima del sorteo. Se comprueba aquí, en el servidor, porque la
  // interfaz se puede saltar con una petición directa. La cantidad pedida son
  // los aleatorios o los números DISTINTOS elegidos a mano: los repetidos se
  // descartan más abajo, así que no sirven para llegar al mínimo.
  const cantidadPedida = wantsRandom
    ? randomCount
    : new Set(input.numbers ?? []).size;
  if (cantidadPedida < raffle.minNumbersPerOrder) {
    const minimo = raffle.minNumbersPerOrder;
    throw new OrderError(
      `La ${operacion} mínima de este sorteo es de ${minimo} ${
        minimo === 1 ? "número" : "números"
      }.`
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

    // Total con el descuento del paquete si la cantidad coincide con uno. Se
    // calcula sobre los números que de verdad se van a reservar, no sobre lo
    // que pidió el navegador.
    const { total } = calcularTotalPedido({
      cantidad: numbers.length,
      pricePerNumber: raffle.pricePerNumber,
      ticketPacksJson: raffle.ticketPacksJson,
    });

    try {
      const order = await prisma.$transaction(async (tx) => {
        // Con celular: el participante es ESE celular, como siempre.
        // `undefined` en el update deja el valor que ya hubiera: una compra
        // sin cédula (o sin correo) nunca borra el dato que el comprador dio
        // en una compra anterior.
        //
        // Sin celular (cuadrícula que reserva solo con el nombre): un
        // participante NUEVO por pedido. Jamás se busca uno "sin celular" ni
        // por nombre: todos los anónimos quedarían fundidos en una sola
        // persona y cada reserva le cambiaría el nombre a las anteriores.
        const participant = phone
          ? await tx.participant.upsert({
              where: { phone },
              update: { name, email, idNumber: cedula, city },
              create: {
                phone,
                name,
                email: email ?? null,
                idNumber: cedula ?? null,
                city: city ?? null,
              },
            })
          : await tx.participant.create({
              data: {
                phone: null,
                name,
                email: email ?? null,
                idNumber: cedula ?? null,
                city: city ?? null,
              },
            });

        const created = await tx.order.create({
          data: {
            code: generateOrderCode(),
            raffleId: raffle.id,
            participantId: participant.id,
            numbersJson: JSON.stringify(numbers),
            quantity: numbers.length,
            // unitPrice sigue siendo el precio de LISTA, no el rebajado: así
            // el panel y el comprobante pueden enseñar "55 × $5.000" junto al
            // total y se ve cuánto se ahorró.
            unitPrice: raffle.pricePerNumber,
            total,
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
    `No fue posible completar tu ${operacion}, intenta de nuevo`,
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
  // Cola de correos del flujo automático. Se llena DENTRO de la transacción
  // (que es donde están los datos) y se envía DESPUÉS de cerrarla: el envío
  // nunca bloquea ni alarga la transacción, y un fallo del proveedor de
  // correo no puede tumbar un pago ya cobrado.
  const correosPendientes: BoletasCorreo[] = [];

  const resultado = await prisma.$transaction(async (tx): Promise<ConfirmResult> => {
    // Bloqueo de fila por orden: serializa confirmaciones concurrentes de la
    // MISMA orden (webhook reintentado por la pasarela + confirmación manual).
    // Sin esto, la segunda transacción vería la orden como PENDING, no
    // encontraría reservas que convertir y rechazaría una orden ya pagada
    // borrando sus números vendidos.
    await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${params.orderId} FOR UPDATE`;

    const order = await tx.order.findUnique({
      where: { id: params.orderId },
      include: { raffle: true, participant: true },
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

    // Se admite PENDING y también EXPIRED.
    //
    // POR QUÉ EXPIRED. La reserva empieza a correr al CREAR el pedido, no al
    // pulsar "pagar". Un comprador que paga por PSE o Nequi tarda de sobra
    // más que eso entre que sale al banco y vuelve, así que su pago llega
    // cuando el pedido ya figura vencido. Antes esto cortaba aquí y el
    // dinero quedaba cobrado sin entregar ni un número: pasó de verdad con
    // el pedido 9Y45RPNH (pago de Bold 69 segundos después del vencimiento).
    //
    // Dejarlo pasar NO regala números: justo debajo está el rescate, que
    // solo re-reclama los que sigan libres. Si ya se le vendieron a otro,
    // el pedido cae en REJECTED con el pago registrado y una entrada de
    // auditoría para devolver la plata o reasignar a mano. Y una orden ya
    // PAID sale antes, por el corto-circuito de más arriba, así que el
    // contador de vendidos no se puede inflar dos veces.
    if (order.status !== "PENDING" && order.status !== "EXPIRED") {
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

    // Ticket premiado: si alguno de los números comprados tiene premio
    // instantáneo y nadie lo había reclamado, queda asignado a esta orden.
    await tx.prizedNumber.updateMany({
      where: {
        raffleId: order.raffleId,
        number: { in: numbers },
        claimedAt: null,
      },
      data: { claimedAt: new Date(), orderId: order.id },
    });

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

    // Flujo automático: si el comprador dejó su correo, sus números le llegan
    // por email. Solo en la transición real a PAGADA, nunca en los reintentos
    // idempotentes (un webhook repetido no puede duplicar el correo).
    const correo = order.participant.email?.trim();
    if (correo && correoConfigurado()) {
      correosPendientes.push({
        para: correo,
        nombre: order.participant.name,
        codigo: order.code,
        tituloRifa: order.raffle.title,
        numeros: formatNumbers(numbers, order.raffle.digits),
        total: order.total,
      });
    }

    return { ok: true, order: updated, alreadyPaid: false };
  });

  // Envío fuera de la transacción y sin await: la respuesta al comprador no
  // espera al proveedor de correo. after() deja que el envío termine aunque
  // la respuesta ya se haya mandado (en serverless, un fetch suelto se corta);
  // fuera de una petición (scripts, pruebas) se dispara y ya. enviarBoletas
  // nunca lanza.
  for (const datos of correosPendientes) {
    try {
      // Callback, no promesa: si after() no está disponible nada se ha
      // enviado todavía y el respaldo no duplica el correo.
      after(() => enviarBoletas(datos));
    } catch {
      void enviarBoletas(datos);
    }
  }

  return resultado;
}

/**
 * Barrido de expiración: marca órdenes PENDING vencidas como EXPIRED y
 * libera sus números. Lo ejecuta el cron y también se invoca de forma
 * oportunista; la corrección NO depende de que corra a tiempo (la
 * liberación perezosa en claimNumbers cubre el intervalo).
 */
export async function expireOverdueOrders(): Promise<number> {
  const now = new Date();
  // Un pedido con un intento de pago registrado NO se vence en el acto: se le
  // dan 30 minutos de gracia. Pagar por PSE o Nequi tarda, y el pago puede
  // llegar despues del plazo de reserva; vencerlo antes es soltarle los
  // numeros a otro comprador mientras el dinero de este ya viajaba. Pasados
  // los 30 minutos sí se vence: para entonces, o Bold ya confirmó, o el
  // intento se quedó a medias.
  const GRACIA_CON_INTENTO_MS = 30 * 60_000;
  const conGracia = new Date(now.getTime() - GRACIA_CON_INTENTO_MS);

  const overdue = await prisma.order.findMany({
    where: {
      status: "PENDING",
      reservedUntil: { lt: now },
      OR: [
        // Sin ningún intento de pago: se vence en cuanto pasa el plazo.
        { payments: { none: {} } },
        // Con intento de pago: solo tras la gracia.
        { payments: { some: {} }, reservedUntil: { lt: conGracia } },
      ],
    },
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

/** Premios instantáneos ganados por una orden (para el comprobante). */
export async function getPrizesWon(
  orderId: string
): Promise<{ number: number; prize: string }[]> {
  const rows = await prisma.prizedNumber.findMany({
    where: { orderId },
    select: { number: true, prize: true },
    orderBy: { number: "asc" },
  });
  return rows;
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
    // Liberar los premios instantáneos que tenía asignados.
    await tx.prizedNumber.updateMany({
      where: { orderId },
      data: { claimedAt: null, orderId: null },
    });
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELLED", reservedUntil: null },
    });
    if (wasPaid) {
      const rifa = await tx.raffle.update({
        where: { id: order.raffleId },
        data: { paidCount: { decrement: order.quantity } },
      });
      // En una cuadrícula agotarse es lo normal (100 números se acaban), y
      // anular una venta devuelve números al tablero: la rifa tiene que volver
      // a venderse sola, o esos números quedarían blancos en una página que
      // dice "agotada". Solo en la cuadrícula: en la rifa grande el estado lo
      // sigue decidiendo el dueño a mano, como siempre.
      if (
        rifa.boardMode &&
        rifa.status === "SOLD_OUT" &&
        rifa.paidCount < rifa.totalNumbers
      ) {
        await tx.raffle.update({
          where: { id: rifa.id },
          data: { status: "ACTIVE" },
        });
      }
    }
    return updated;
  });
}

/**
 * Pedido creado A MANO por el dueño desde el tablero del panel.
 *
 * Es la venta que cierra él por su cuenta —"apártame el 23", le escriben por
 * WhatsApp sin pasar por la página—: escoge las casillas, escribe el nombre y,
 * si ya le pagaron, el pedido nace confirmado (verde); si no, queda apartado
 * (amarillo) con el mismo plazo que una reserva de la página.
 *
 * Pasa por el MISMO camino que una reserva del público —transacción +
 * claimNumbers—, así que el índice único de la base sigue siendo el árbitro:
 * si un comprador tomó una casilla un instante antes, aquí sale el 409 con los
 * números en conflicto y no se vende nada dos veces. Solo para rifas de
 * cuadrícula: la rifa grande no tiene tablero y no se toca.
 */
export async function createManualOrder(input: {
  raffleId: string;
  numbers: number[];
  name: string;
  phone?: string;
  /** El dueño ya recibió el dinero: el pedido nace PAGADO. */
  markPaid: boolean;
}): Promise<{ order: Order; numbers: number[]; confirmado: boolean }> {
  const raffle = await prisma.raffle.findUnique({
    where: { id: input.raffleId },
  });
  if (!raffle) throw new OrderError("Sorteo no encontrado", 404);
  if (!raffle.boardMode) {
    throw new OrderError(
      "Solo se puede apartar a mano en las rifas de cuadrícula"
    );
  }
  if (raffle.status === "FINISHED" || raffle.status === "CANCELLED") {
    throw new OrderError("Este sorteo ya no está en venta");
  }

  const name = input.name.trim();
  if (name.length < 2) throw new OrderError("Escribe el nombre de la persona");

  // El celular es opcional aquí (el dueño ya habla con la persona). Si lo
  // escribe, tiene que ser válido: un número mal tecleado guardaría a la
  // persona con el WhatsApp de otra.
  let phone: string | null = null;
  const crudo = (input.phone ?? "").trim();
  if (crudo) {
    phone = normalizeWhatsApp(crudo);
    if (!phone) throw new OrderError("El número de celular no es válido");
  }

  const numbers = [...new Set(input.numbers)].sort((a, b) => a - b);
  // Sin tope por pedido: el dueño puede apartarle 30 números a una misma
  // persona. El techo es el tablero completo.
  const validation = validateSelection(
    numbers,
    raffle.totalNumbers,
    raffle.totalNumbers
  );
  if (validation) throw new OrderError(validation);

  const reservedUntil = new Date(
    Date.now() + raffle.reservationMinutes * 60_000
  );
  const { total } = calcularTotalPedido({
    cantidad: numbers.length,
    pricePerNumber: raffle.pricePerNumber,
    ticketPacksJson: raffle.ticketPacksJson,
  });

  let order: Order;
  try {
    order = await prisma.$transaction(async (tx) => {
      const participant = phone
        ? await tx.participant.upsert({
            where: { phone },
            update: { name },
            create: { phone, name },
          })
        : await tx.participant.create({ data: { phone: null, name } });
      const created = await tx.order.create({
        data: {
          code: generateOrderCode(),
          raffleId: raffle.id,
          participantId: participant.id,
          numbersJson: JSON.stringify(numbers),
          quantity: numbers.length,
          unitPrice: raffle.pricePerNumber,
          total,
          status: "PENDING",
          reservedUntil,
        },
      });
      await claimNumbers(tx, raffle.id, numbers, created.id, reservedUntil);
      return created;
    });
  } catch (err) {
    if (err instanceof ClaimConflictError) {
      throw new OrderError(
        "Algunos números ya no están libres",
        409,
        err.conflicting
      );
    }
    throw err;
  }

  if (!input.markPaid) return { order, numbers, confirmado: false };

  // Segundo paso, ya con los números en su poder: la confirmación es el mismo
  // camino idempotente que usa el botón "Confirmar pago" (contador, agotado,
  // números premiados, correo). Si fallara, el pedido queda apartado y el
  // dueño lo ve en amarillo: nada se pierde.
  const res = await confirmOrderPayment({
    orderId: order.id,
    provider: "manual",
  });
  if (!res.ok) return { order, numbers, confirmado: false };
  return { order: res.order, numbers, confirmado: true };
}
