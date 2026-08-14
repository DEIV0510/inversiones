/**
 * Borra TODO el contenido de demostración y apaga el aviso público.
 * Deja el sitio limpio para publicar el primer sorteo real.
 * Uso: npx tsx scripts/limpiar-demo.ts
 *
 * Solo toca lo marcado como demostración:
 *  - rifas cuyo título empieza por "DEMO ·" (con sus números y pedidos)
 *  - ganadores marcados como demo
 *  - usuarios administrativos @demo.com
 * La configuración del negocio (WhatsApp, redes, ubicación) se conserva.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const demoRaffles = await prisma.raffle.findMany({
    where: { title: { startsWith: "DEMO ·" } },
    select: { id: true, title: true },
  });
  const ids = demoRaffles.map((r) => r.id);

  if (ids.length > 0) {
    const orders = await prisma.order.findMany({
      where: { raffleId: { in: ids } },
      select: { id: true, participantId: true },
    });
    const orderIds = orders.map((o) => o.id);
    const participantIds = [...new Set(orders.map((o) => o.participantId))];

    await prisma.payment.deleteMany({ where: { orderId: { in: orderIds } } });
    await prisma.raffleNumber.deleteMany({ where: { raffleId: { in: ids } } });
    await prisma.order.deleteMany({ where: { raffleId: { in: ids } } });
    await prisma.winner.deleteMany({ where: { raffleId: { in: ids } } });
    await prisma.raffle.deleteMany({ where: { id: { in: ids } } });

    // Participantes que solo existían por la demostración.
    for (const pid of participantIds) {
      const restantes = await prisma.order.count({ where: { participantId: pid } });
      if (restantes === 0) {
        await prisma.participant.delete({ where: { id: pid } }).catch(() => null);
      }
    }
    console.log(`Rifas de demostración eliminadas: ${demoRaffles.length}`);
  }

  const winners = await prisma.winner.deleteMany({ where: { isDemo: true } });
  const users = await prisma.adminUser.deleteMany({
    where: { email: { endsWith: "@demo.com" } },
  });
  const logs = await prisma.auditLog.deleteMany({});

  await prisma.setting.upsert({
    where: { key: "demo_mode" },
    update: { value: "0" },
    create: { key: "demo_mode", value: "0" },
  });

  console.log(
    `Ganadores demo: ${winners.count} · usuarios demo: ${users.count} · auditoría: ${logs.count}`
  );
  console.log("Aviso de demostración APAGADO. El sitio quedó limpio.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
