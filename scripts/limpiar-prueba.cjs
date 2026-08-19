/**
 * Borra pedidos de prueba de la base de DESARROLLO dejando los contadores
 * cuadrados.
 *
 * ⚠️ Un pedido PAGADO suma en `Raffle.paidCount`, que es lo que pinta la barra
 * de avance pública. Borrar sus filas a pelo deja ese contador inflado y la
 * barra miente. Por eso aquí se descuenta y se liberan los premios
 * instantáneos que hubiera reclamado, igual que hace cancelOrder.
 *
 * Uso:  node scripts/limpiar-prueba.cjs "Nombre del participante"
 */
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const NOMBRE = process.argv[2] || "Prueba";

(async () => {
  const orders = await p.order.findMany({
    where: { participant: { name: { startsWith: NOMBRE } } },
    select: { id: true, code: true, status: true, raffleId: true, participantId: true },
  });

  if (orders.length === 0) {
    console.log(`no hay pedidos cuyo participante empiece por "${NOMBRE}"`);
    await p.$disconnect();
    return;
  }

  for (const o of orders) {
    // Cuántos números suyos estaban PAGADOS: eso es lo que hay que descontar.
    const pagados = await p.raffleNumber.count({
      where: { orderId: o.id, status: "PAID" },
    });

    // Los premios instantáneos vuelven a estar sin reclamar.
    const premios = await p.prizedNumber.updateMany({
      where: { orderId: o.id },
      data: { claimedAt: null, orderId: null },
    });

    await p.raffleNumber.deleteMany({ where: { orderId: o.id } });
    await p.payment.deleteMany({ where: { orderId: o.id } });
    await p.order.delete({ where: { id: o.id } });

    if (pagados > 0) {
      await p.raffle.update({
        where: { id: o.raffleId },
        data: { paidCount: { decrement: pagados } },
      });
    }
    await p.participant.delete({ where: { id: o.participantId } }).catch(() => {});

    console.log(
      `${o.code} (${o.status}) borrado · ${pagados} pagados descontados · ${premios.count} premios liberados`
    );
  }

  // Red de seguridad: que ninguna rifa quede con el contador por encima de la
  // realidad, venga de donde venga el descuadre.
  const rifas = await p.raffle.findMany({ select: { id: true, slug: true, paidCount: true } });
  for (const r of rifas) {
    const real = await p.raffleNumber.count({ where: { raffleId: r.id, status: "PAID" } });
    if (real !== r.paidCount) {
      await p.raffle.update({ where: { id: r.id }, data: { paidCount: real } });
      console.log(`  contador corregido en ${r.slug}: ${r.paidCount} → ${real}`);
    }
  }

  await p.$disconnect();
})();
