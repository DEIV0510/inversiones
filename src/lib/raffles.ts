import { prisma } from "./db";

/** Rifas visibles en la landing, ordenadas. */
export async function getPublicRaffles() {
  return prisma.raffle.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function getPublishedWinners() {
  return prisma.winner.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });
}
