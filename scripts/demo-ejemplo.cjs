// Configura las rifas de demostración con el formato del ejemplo:
// paquetes grandes con su precio y números premiados publicados.
// Solo toca rifas cuyo slug empieza por "demo-".
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

const MILLON = [1845, 2578, 3269, 4125, 5093, 6182, 7251, 8376, 9482, 1038];
const MOTO = [1458, 2783, 3569, 4892, 5237];

(async () => {
  const efectivo = await p.raffle.findUnique({
    where: { slug: "demo-dos-millones-en-efectivo" },
  });
  if (efectivo) {
    await p.raffle.update({
      where: { id: efectivo.id },
      data: {
        selectionMode: "RANDOM",
        whatsappCheckout: true,
        maxNumbersPerOrder: 600,
        ticketPacksJson: JSON.stringify([16, 20, 27, 40, 80, 160, 300, 600]),
        pricePerNumber: 1300,
        digits: 4,
      },
    });
    await p.prizedNumber.deleteMany({
      where: { raffleId: efectivo.id, claimedAt: null },
    });
    await p.prizedNumber.createMany({
      data: [
        ...MILLON.map((number) => ({
          raffleId: efectivo.id,
          number,
          prize: "$1.000.000",
        })),
        ...MOTO.map((number) => ({
          raffleId: efectivo.id,
          number,
          prize: "una moto Honda XR150",
        })),
      ],
      skipDuplicates: true,
    });
    console.log("listo:", efectivo.slug);
  }

  const millon = await p.raffle.findUnique({
    where: { slug: "demo-millon-de-numeros" },
  });
  if (millon) {
    await p.raffle.update({
      where: { id: millon.id },
      data: { whatsappCheckout: false, maxNumbersPerOrder: 50 },
    });
    console.log("listo (sin WhatsApp):", millon.slug);
  }

  await p.$disconnect();
})();
