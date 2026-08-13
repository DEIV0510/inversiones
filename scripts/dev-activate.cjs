// Activa la rifa de prueba en la base de desarrollo.
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  await p.raffle.update({
    where: { slug: "gran-sorteo-motocicleta-0-km" },
    data: {
      status: "ACTIVE",
      progressMode: "AUTO",
      totalNumbers: 10000,
      digits: 4,
      pricePerNumber: 10000,
      reservationMinutes: 10,
      maxNumbersPerOrder: 20,
    },
  });
  console.log("rifa ACTIVA en dev");
  await p.$disconnect();
})();
