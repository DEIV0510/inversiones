// Radiografía de la base de producción antes de tocar nada.
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const tablas = await p.$queryRawUnsafe(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name`
  );
  const cols = await p.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Raffle' ORDER BY column_name`
  );
  const [raffles, orders, numbers, participants] = await Promise.all([
    p.raffle.count(),
    p.order.count(),
    p.raffleNumber.count(),
    p.participant.count(),
  ]);
  console.log("tablas:", tablas.map((t) => t.table_name).join(", "));
  console.log("columnas de Raffle:", cols.map((c) => c.column_name).join(", "));
  console.log({ raffles, orders, numbers, participants });
  await p.$disconnect();
})();
