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
  `CREATE INDEX IF NOT EXISTS "Order_status_paidAt_idx" ON "Order"("status", "paidAt")`,
  `CREATE INDEX IF NOT EXISTS "PrizedNumber_raffleId_claimedAt_idx" ON "PrizedNumber"("raffleId", "claimedAt")`,
];

(async () => {
  for (const sql of SENTENCIAS) {
    await p.$executeRawUnsafe(sql);
    console.log("ok:", sql.slice(0, 78));
  }

  const cols = await p.$queryRawUnsafe(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name='Raffle'
       AND column_name IN ('whatsappCheckout','selectionMode','ticketPacksJson','prizesJson','digits','showPrize','showDrawDate')`
  );
  console.log("Raffle nuevo:", cols.map((c) => c.column_name).sort().join(", "));
  await p.$disconnect();
})();
