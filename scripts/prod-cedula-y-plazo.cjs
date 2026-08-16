/**
 * Producción: agrega la cédula del comprador y da un plazo realista a las
 * rifas que cobran por WhatsApp.
 *
 * Con cobro por WhatsApp el dueño tiene que ver el mensaje, mandar los datos
 * de la cuenta y esperar el comprobante: 15 minutos no alcanzan y los números
 * se liberarían con el cliente ya pagando. 12 horas es un plazo cómodo, y
 * queda ajustable por rifa desde el panel.
 */
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const PLAZO_WHATSAPP = 720; // minutos = 12 horas

(async () => {
  // 1) Columna nueva, aditiva: nadie pierde datos.
  await p.$executeRawUnsafe(
    `ALTER TABLE "Participant" ADD COLUMN IF NOT EXISTS "idNumber" TEXT`
  );
  await p.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Participant_email_idx" ON "Participant"("email")`
  );
  await p.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "Participant_idNumber_idx" ON "Participant"("idNumber")`
  );
  console.log("columna cédula e índices de búsqueda: listos");

  // 2) Plazo de pago realista donde se cobra por WhatsApp.
  const rifas = await p.raffle.findMany({
    where: { whatsappCheckout: true },
    select: { id: true, slug: true, reservationMinutes: true },
  });
  for (const r of rifas) {
    if (r.reservationMinutes >= PLAZO_WHATSAPP) continue;
    await p.raffle.update({
      where: { id: r.id },
      data: { reservationMinutes: PLAZO_WHATSAPP },
    });
    console.log(
      `${r.slug}: plazo de pago ${r.reservationMinutes} min → ${PLAZO_WHATSAPP} min (12 h)`
    );
  }

  await p.$disconnect();
})();
