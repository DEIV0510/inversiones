import { prisma } from "./db";

/**
 * Rifas visibles en la landing, ordenadas. El `select` excluye desde la capa
 * de datos los campos internos (totalNumbers, notes): nunca deben salir al
 * público.
 */
export async function getPublicRaffles() {
  return prisma.raffle.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      prize: true,
      imageUrl: true,
      priceCop: true,
      drawDateText: true,
      progressPct: true,
      status: true,
    },
  });
}

export async function getPublishedWinners() {
  return prisma.winner.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });
}
