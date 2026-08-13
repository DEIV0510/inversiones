import type { Raffle } from "@prisma/client";
import { prisma } from "./db";

/**
 * Consultas públicas. Regla de negocio: al público JAMÁS se le muestran
 * cantidades vendidas/restantes — solo el porcentaje. El tamaño de la rifa
 * (dígitos/rango) sí es público porque es necesario para elegir número.
 */

export const PUBLIC_STATUSES = [
  "COMING_SOON",
  "ACTIVE",
  "SOLD_OUT",
  "FINISHED",
] as const;

export type PublicRaffle = {
  id: string;
  slug: string;
  title: string;
  description: string;
  prize: string;
  imageUrl: string | null;
  gallery: string[];
  pricePerNumber: number;
  drawDateText: string | null;
  status: string;
  progressPct: number;
  digits: number;
  totalNumbers: number;
  maxNumbersPerOrder: number;
  reservationMinutes: number;
  terms: string;
};

/** Porcentaje visible: automático (vendidos/total) o manual. */
export function progressPctOf(raffle: {
  progressMode: string;
  manualProgressPct: number;
  paidCount: number;
  totalNumbers: number;
}): number {
  if (raffle.progressMode === "MANUAL") {
    return Math.max(0, Math.min(100, raffle.manualProgressPct));
  }
  if (raffle.totalNumbers <= 0) return 0;
  return Math.max(
    0,
    Math.min(100, Math.floor((raffle.paidCount * 100) / raffle.totalNumbers))
  );
}

export function toPublicRaffle(raffle: Raffle): PublicRaffle {
  let gallery: string[] = [];
  try {
    const parsed = JSON.parse(raffle.galleryJson);
    if (Array.isArray(parsed)) gallery = parsed.filter((g) => typeof g === "string");
  } catch {
    // galería corrupta → vacía
  }
  return {
    id: raffle.id,
    slug: raffle.slug,
    title: raffle.title,
    description: raffle.description,
    prize: raffle.prize,
    imageUrl: raffle.imageUrl,
    gallery,
    pricePerNumber: raffle.pricePerNumber,
    drawDateText: raffle.drawDateText,
    status: raffle.status,
    progressPct: progressPctOf(raffle),
    digits: raffle.digits,
    totalNumbers: raffle.totalNumbers,
    maxNumbersPerOrder: raffle.maxNumbersPerOrder,
    reservationMinutes: raffle.reservationMinutes,
    terms: raffle.terms,
  };
}

export async function getPublicRaffles(): Promise<PublicRaffle[]> {
  const raffles = await prisma.raffle.findMany({
    where: { status: { in: [...PUBLIC_STATUSES] } },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });
  return raffles.map(toPublicRaffle);
}

export async function getPublicRaffleBySlug(
  slug: string
): Promise<PublicRaffle | null> {
  const raffle = await prisma.raffle.findUnique({ where: { slug } });
  if (!raffle || !PUBLIC_STATUSES.includes(raffle.status as never)) return null;
  return toPublicRaffle(raffle);
}

export async function getPublishedWinners() {
  return prisma.winner.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
    take: 12,
  });
}
