// Pone la compra mínima de cada rifa demo en su paquete más pequeño y limpia
// los pedidos de prueba que haya dejado una verificación.
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  // 1) Limpieza de pedidos de prueba (por nombre del participante).
  const prueba = await p.order.findMany({
    where: { participant: { name: { startsWith: "Verificacion" } } },
    select: { id: true, code: true, participantId: true },
  });
  for (const o of prueba) {
    await p.raffleNumber.deleteMany({ where: { orderId: o.id } });
    await p.payment.deleteMany({ where: { orderId: o.id } });
    await p.order.delete({ where: { id: o.id } });
    await p.participant
      .delete({ where: { id: o.participantId } })
      .catch(() => {});
    console.log("pedido de prueba borrado:", o.code);
  }

  // 2) Compra mínima = paquete más pequeño de cada rifa.
  const rifas = await p.raffle.findMany({
    select: { id: true, slug: true, ticketPacksJson: true, maxNumbersPerOrder: true },
  });
  for (const r of rifas) {
    let packs = [];
    try {
      const parsed = JSON.parse(r.ticketPacksJson);
      if (Array.isArray(parsed)) {
        packs = parsed.filter((n) => typeof n === "number" && n > 0);
      }
    } catch {
      // paquetes corruptos → se deja el mínimo en 1
    }
    const minimo = packs.length > 0 ? Math.min(...packs) : 1;
    const seguro = Math.min(minimo, r.maxNumbersPerOrder);
    await p.raffle.update({
      where: { id: r.id },
      data: { minNumbersPerOrder: seguro },
    });
    console.log(`${r.slug}: compra mínima ${seguro}`);
  }

  await p.$disconnect();
})();
