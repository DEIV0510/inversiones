// Lista las rifas de producción con su configuración nueva.
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const rifas = await p.raffle.findMany({
    orderBy: { displayOrder: "asc" },
    select: {
      slug: true,
      title: true,
      status: true,
      digits: true,
      totalNumbers: true,
      pricePerNumber: true,
      selectionMode: true,
      whatsappCheckout: true,
      ticketPacksJson: true,
      maxNumbersPerOrder: true,
      _count: { select: { prizedNumbers: true } },
    },
  });
  for (const r of rifas) console.log(r);
  await p.$disconnect();
})();
