import { prisma } from "@/lib/db";
import {
  boldOrderId,
  boldVoucherConfirmaOrden,
  fetchBoldTransaction,
  isBoldConfigured,
} from "@/lib/bold";
import { confirmOrderPayment } from "@/lib/engine/orders";

/**
 * Barrido de respaldo: busca pedidos que siguen PENDIENTES y le pregunta a
 * Bold si en realidad ya se pagaron.
 *
 * POR QUÉ EXISTE. La vía normal es el webhook firmado, que confirma en
 * segundos. Pero si el webhook no está registrado en el panel de Bold, o se
 * cayó, o Bold dejó de reintentar, el dinero entra y el pedido se queda
 * pendiente para siempre: el comprador no ve sus números y al dueño le toca
 * marcarlos a mano uno por uno. Con miles de transferencias eso es
 * impracticable, y es justo lo que este barrido evita.
 *
 * NO SUSTITUYE AL WEBHOOK. Bold avisa que su consulta puede tardar ~10
 * minutos en reflejar una venta, y en el plan Hobby de Vercel el cron solo
 * corre una vez al día. Esto es una red de seguridad, no el camino principal.
 *
 * Reglas que NO se relajan aquí: solo confirma con estado APPROVED y monto
 * EXACTO (lo comprueba boldVoucherConfirmaOrden), y confirmOrderPayment es
 * idempotente, así que cruzarse con el webhook no duplica nada.
 */
export async function barrerPagosBoldPendientes(opciones?: {
  /** Techo de pedidos a consultar en una pasada. */
  max?: number;
  /** Antigüedad máxima del pedido, en días. */
  diasAtras?: number;
}): Promise<{
  revisados: number;
  confirmados: number;
  /** Pedidos que quedaron sin revisar por el techo (0 = se revisaron todos). */
  sinRevisar: number;
  /**
   * Pedidos YA VENCIDOS que sin embargo tienen un pago aprobado en Bold.
   * Son el caso más feo que existe aquí: el comprador pagó de verdad y se
   * quedó sin números. NO se confirman solos porque sus números pudieron
   * venderse a otro; hay que mirarlos a mano y devolver el dinero o
   * reasignar. Se listan para que no se pierdan en silencio.
   */
  vencidosConPago: string[];
}> {
  if (!isBoldConfigured()) {
    return { revisados: 0, confirmados: 0, sinRevisar: 0, vencidosConPago: [] };
  }

  const max = opciones?.max ?? 200;
  const diasAtras = opciones?.diasAtras ?? 7;
  const desde = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000);

  const donde = {
    status: "PENDING" as const,
    createdAt: { gte: desde },
  };

  // Se cuentan aparte para poder DECIR cuántos quedaron fuera del techo. Un
  // barrido que trunca en silencio se lee como "ya revisé todo" cuando no es
  // verdad, y eso es justo lo que no puede pasar con dinero de por medio.
  const total = await prisma.order.count({ where: donde });
  const pendientes = await prisma.order.findMany({
    where: donde,
    select: { id: true, code: true, total: true },
    orderBy: { createdAt: "desc" },
    take: max,
  });

  let confirmados = 0;
  for (const pedido of pendientes) {
    const referencia = boldOrderId(pedido.code);
    const voucher = await fetchBoldTransaction(referencia);
    if (!boldVoucherConfirmaOrden(voucher, pedido)) continue;

    const res = await confirmOrderPayment({
      orderId: pedido.id,
      provider: "bold",
      providerTxId: referencia,
      reference: referencia,
      amount: Math.round(voucher!.total!),
      raw: voucher,
    });
    if (res.ok) {
      confirmados += 1;
      console.log(
        `[barrido-bold] pedido ${pedido.code} confirmado por consulta ` +
          `(no había llegado el webhook)`
      );
    }
  }

  // ── Vencidos que en realidad SÍ se pagaron ───────────────────────────
  // La reserva dura 12 h y este barrido corre una vez al día (tope del plan
  // Hobby de Vercel), así que un pedido puede vencerse antes de que lleguemos
  // a mirarlo. Si además falló el webhook, el comprador pagó y se quedó sin
  // números: es dinero cobrado sin entregar nada. No se confirma solo — sus
  // números pueden estar ya vendidos a otra persona — pero tampoco se calla.
  const vencidos = await prisma.order.findMany({
    where: { status: "EXPIRED", createdAt: { gte: desde } },
    select: { id: true, code: true, total: true },
    orderBy: { createdAt: "desc" },
    take: max,
  });

  const vencidosConPago: string[] = [];
  for (const pedido of vencidos) {
    const voucher = await fetchBoldTransaction(boldOrderId(pedido.code));
    if (!boldVoucherConfirmaOrden(voucher, pedido)) continue;
    vencidosConPago.push(pedido.code);
    console.warn(
      `[barrido-bold] ATENCIÓN: el pedido ${pedido.code} está VENCIDO pero ` +
        `tiene un pago APROBADO en Bold por $${pedido.total}. El comprador ` +
        `pagó y no tiene números. Revisar a mano.`
    );
  }

  return {
    revisados: pendientes.length,
    confirmados,
    vencidosConPago,
    sinRevisar: Math.max(0, total - pendientes.length),
  };
}
