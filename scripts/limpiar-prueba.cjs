// Borra la orden de prueba del paquete de 600 y libera sus nÃºmeros.
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const orders = await p.order.findMany({
    where: { participant: { name: "Prueba Paquete Grande" } },
    select: { id: true, code: true },
  });
  for (const o of orders) {
    await p.raffleNumber.deleteMany({ where: { orderId: o.id } });
    await p.payment.deleteMany({ where: { orderId: o.id } });
    await p.order.delete({ where: { id: o.id } });
    console.log("orden de prueba eliminada:", o.code);
  }
  if (orders.length === 0) console.log("no habÃ­a Ã³rdenes de prueba");
  await p.$disconnect();
})();
