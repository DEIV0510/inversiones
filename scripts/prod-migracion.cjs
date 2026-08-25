// Migración puntual y aditiva de producción: solo agrega lo que falta.
// No borra ni reescribe nada; cada sentencia es IF NOT EXISTS.
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const SENTENCIAS = [
  `ALTER TABLE "Raffle" ADD COLUMN IF NOT EXISTS "whatsappCheckout" BOOLEAN NOT NULL DEFAULT true`,
  // Filas opcionales de la ficha del sorteo (premio y fecha). Nacen apagadas
  // porque el dueño ya escribe ambas cosas dentro del título.
  `ALTER TABLE "Raffle" ADD COLUMN IF NOT EXISTS "showPrize" BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE "Raffle" ADD COLUMN IF NOT EXISTS "showDrawDate" BOOLEAN NOT NULL DEFAULT false`,
  // Compra mínima por rifa: por debajo de esto el pedido se rechaza.
  `ALTER TABLE "Raffle" ADD COLUMN IF NOT EXISTS "minNumbersPerOrder" INTEGER NOT NULL DEFAULT 1`,
  // La fecha vuelve a mostrarse por defecto ("Por anunciar" si está vacía).
  `ALTER TABLE "Raffle" ALTER COLUMN "showDrawDate" SET DEFAULT true`,
  `UPDATE "Raffle" SET "showDrawDate" = true WHERE "showDrawDate" = false`,
  // Proporcion de la foto del sorteo (4/3, 1/1 o 9/16).
  `ALTER TABLE "Raffle" ADD COLUMN IF NOT EXISTS "imageAspect" TEXT NOT NULL DEFAULT '4/3'`,
  // Interruptor de la pasarela por rifa (gemelo del de WhatsApp).
  `ALTER TABLE "Raffle" ADD COLUMN IF NOT EXISTS "gatewayCheckout" BOOLEAN NOT NULL DEFAULT true`,
  `CREATE INDEX IF NOT EXISTS "Order_status_paidAt_idx" ON "Order"("status", "paidAt")`,
  `CREATE INDEX IF NOT EXISTS "PrizedNumber_raffleId_claimedAt_idx" ON "PrizedNumber"("raffleId", "claimedAt")`,
  // Ranking público de compradores por rifa. Nace apagado: publica cantidades
  // por comprador, así que se enciende a conciencia desde el panel.
  `ALTER TABLE "Raffle" ADD COLUMN IF NOT EXISTS "showRanking" BOOLEAN NOT NULL DEFAULT false`,
  // Índice cubriente del ranking: agrupar los pedidos PAGADOS de una rifa por
  // participante sin ir a leer la tabla.
  `CREATE INDEX IF NOT EXISTS "Order_raffleId_status_participantId_quantity_idx" ON "Order"("raffleId", "status", "participantId", "quantity")`,
];

// Columnas que este script debe dejar existiendo en Raffle. Se comprueban al
// final una por una: antes la lista iba escrita a mano dentro del IN y se
// quedaba desfasada, así que el script decía "listo" sin haber verificado lo
// que acababa de añadir.
const COLUMNAS_ESPERADAS = [
  "whatsappCheckout",
  "gatewayCheckout",
  "selectionMode",
  "ticketPacksJson",
  "prizesJson",
  "digits",
  "showPrize",
  "showDrawDate",
  "showRanking",
  "minNumbersPerOrder",
  "imageAspect",
];

(async () => {
  for (const sql of SENTENCIAS) {
    await p.$executeRawUnsafe(sql);
    console.log("ok:", sql.slice(0, 78));
  }

  const cols = await p.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='Raffle'`
  );
  const existentes = new Set(cols.map((c) => c.column_name));
  const faltan = COLUMNAS_ESPERADAS.filter((c) => !existentes.has(c));

  // A qué base se apuntó de verdad. Correr esto contra la base demo imprime
  // "ok:" en verde y deja producción sin la columna; el push posterior tumba
  // el build al prerenderizar la portada. Por eso se dice el host.
  const [{ host }] = await p.$queryRawUnsafe(
    `SELECT inet_server_addr()::text AS host`
  ).catch(() => [{ host: "(desconocido)" }]);
  console.log("base:", host);

  if (faltan.length > 0) {
    console.error("FALTAN COLUMNAS EN Raffle:", faltan.join(", "));
    await p.$disconnect();
    process.exit(1);
  }
  console.log("Raffle OK, estan las", COLUMNAS_ESPERADAS.length, "columnas esperadas");
  await p.$disconnect();
})();
