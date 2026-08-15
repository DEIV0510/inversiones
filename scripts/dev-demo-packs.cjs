// Ajusta la demo al ejemplo que compartió el dueño: paquetes grandes con
// su precio, números premiados publicados y compra cerrada por WhatsApp.
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

(async () => {
  const efectivo = await p.raffle.update({
    where: { slug: "demo-dos-millones-en-efectivo" },
    data: {
      selectionMode: "RANDOM",
      whatsappCheckout: true,
      maxNumbersPerOrder: 600,
      ticketPacksJson: JSON.stringify([16, 20, 27, 40, 80, 160, 300, 600]),
      pricePerNumber: 1300,
      totalNumbers: 10000,
      digits: 4,
    },
  });

  // Números premiados como en el ejemplo: varios con el mismo premio.
  await p.prizedNumber.deleteMany({ where: { raffleId: efectivo.id } });
  const millon = [1845, 2578, 3269, 4125, 5093, 6182, 7251, 8376, 9482, 1038];
  const moto = [1458, 2783, 3569, 4892, 5237];
  await p.prizedNumber.createMany({
    data: [
      ...millon.map((number) => ({
        raffleId: efectivo.id,
        number,
        prize: "$1.000.000",
      })),
      ...moto.map((number) => ({
        raffleId: efectivo.id,
        number,
        prize: "una moto Honda XR150",
      })),
    ],
    skipDuplicates: true,
  });

  await p.raffle.update({
    where: { slug: "demo-millon-de-numeros" },
    data: { whatsappCheckout: false, maxNumbersPerOrder: 50 },
  });

  console.log("demo ajustada al ejemplo: paquetes con precio y premiados");
  await p.$disconnect();
})();
