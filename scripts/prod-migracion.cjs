// Migración puntual y aditiva de producción: solo agrega lo que falta.
// No borra ni reescribe nada; cada sentencia es IF NOT EXISTS.
//
// ⚠️ ESTE SCRIPT NO SABE SOLO A QUÉ BASE VA. Ejecutado a secas, Prisma carga
// el .env de la raíz, que apunta a la base DEMO: el script imprimiría "ok:"
// en verde y producción se quedaría sin la columna. El push posterior tumba
// el build al prerenderizar la portada. Por eso hay que decirle la URL a
// propósito y confirmarla:
//
//   npx vercel env pull .env.prod --environment=production --yes
//   node -e "require('dotenv').config({path:'.env.prod'}); \
//            process.env.MIGRAR_A_PRODUCCION='si'; \
//            require('./scripts/prod-migracion.cjs')"
//
// Y OJO con querer detectar la base preguntándole al servidor: en Neon
// `inet_server_addr()` devuelve ::1/128 y `current_database()` devuelve
// "neondb" para CUALQUIER proyecto, porque el proxy habla con el compute por
// loopback. Lo único que distingue una base de otra es el HOST de la cadena
// de conexión (y `neon.endpoint_id`, que se lee abajo).
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

/** Host de la URL con la que Prisma se va a conectar de verdad. */
function hostDestino() {
  const url =
    process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL || "";
  const m = url.match(/@([^/?]+)/);
  return m ? m[1] : "(no se pudo leer la URL)";
}

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
  // Índice del ranking: filtra los pedidos PAGADOS de una rifa y los entrega
  // ya ordenados por participante, así el GROUP BY se ahorra el Sort. No es
  // cubriente: el desempate usa MIN(createdAt), que no está aquí.
  `CREATE INDEX IF NOT EXISTS "Order_raffleId_status_participantId_quantity_idx" ON "Order"("raffleId", "status", "participantId", "quantity")`,
  // Ciudad o municipio del comprador. Opcional; nunca sale al publico.
  `ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS "city" TEXT`,
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
  // 1. DECIR A QUÉ BASE VA, ANTES de escribir nada.
  const host = hostDestino();
  let endpoint = "(desconocido)";
  try {
    const [f] = await p.$queryRawUnsafe(
      `SELECT current_setting('neon.endpoint_id', true) AS endpoint`
    );
    if (f && f.endpoint) endpoint = f.endpoint;
  } catch {
    // Fuera de Neon ese ajuste no existe: no es motivo para abortar.
  }
  console.log("destino  host:", host);
  console.log("destino  neon endpoint:", endpoint);

  // 2. Exigir una confirmación explícita. Sin esto, correr el script a secas
  //    migra la base DEMO creyendo que migró producción.
  if (process.env.MIGRAR_A_PRODUCCION !== "si") {
    console.error(
      "\nABORTADO: falta la confirmación explícita.\n" +
        "Comprueba arriba que el host es el de PRODUCCIÓN y vuelve a lanzarlo\n" +
        "con MIGRAR_A_PRODUCCION=si en el entorno. Ver la cabecera del script."
    );
    await p.$disconnect();
    process.exit(1);
  }

  for (const sql of SENTENCIAS) {
    await p.$executeRawUnsafe(sql);
    console.log("ok:", sql.slice(0, 78));
  }

  // 3. Verificar de verdad lo que se acaba de añadir. Antes se comparaba
  //    contra una lista escrita a mano dentro del IN (...) que estaba
  //    desfasada: el script decía "listo" sin comprobar nada nuevo.
  const cols = await p.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='Raffle'`
  );
  const existentes = new Set(cols.map((c) => c.column_name));
  const faltan = COLUMNAS_ESPERADAS.filter((c) => !existentes.has(c));

  if (faltan.length > 0) {
    console.error("FALTAN COLUMNAS EN Raffle:", faltan.join(", "));
    await p.$disconnect();
    process.exit(1);
  }
  console.log("Raffle OK en", host, "— estan las", COLUMNAS_ESPERADAS.length, "columnas esperadas");
  await p.$disconnect();
})();
