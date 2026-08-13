import { randomInt } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

/**
 * Motor de disponibilidad y reservas.
 *
 * Diseño: asignación perezosa. Solo existe fila en RaffleNumber para números
 * TOMADOS (RESERVED | PAID | BLOCKED). Un número está disponible cuando no
 * tiene fila, o cuando su fila es una reserva ya expirada (que se libera de
 * forma perezosa en el próximo intento de reclamo). La restricción
 * UNIQUE(raffleId, number) de Postgres es el árbitro final contra dobles
 * ventas: dos transacciones concurrentes jamás pueden insertar el mismo
 * número.
 */

type Tx = Prisma.TransactionClient | PrismaClient;

export class ClaimConflictError extends Error {
  constructor(public conflicting: number[]) {
    super("Algunos números ya no están disponibles");
    this.name = "ClaimConflictError";
  }
}

/** ¿La fila representa un número realmente ocupado en este momento? */
export function isRowAlive(
  row: { status: string; reservedUntil: Date | null },
  now = new Date()
): boolean {
  if (row.status !== "RESERVED") return true; // PAID y BLOCKED siempre ocupan
  return row.reservedUntil != null && row.reservedUntil > now;
}

/**
 * Reclama números para una orden de forma atómica.
 * Debe ejecutarse DENTRO de una transacción. Lanza ClaimConflictError si
 * alguno ya está tomado (la transacción completa se revierte).
 */
export async function claimNumbers(
  tx: Tx,
  raffleId: string,
  numbers: number[],
  orderId: string,
  reservedUntil: Date
): Promise<void> {
  const now = new Date();

  // 1. Liberación perezosa: elimina reservas EXPIRADAS que estorben.
  await tx.raffleNumber.deleteMany({
    where: {
      raffleId,
      number: { in: numbers },
      status: "RESERVED",
      reservedUntil: { lt: now },
    },
  });

  // 2. Inserción atómica: ON CONFLICT DO NOTHING vía skipDuplicates.
  //    Postgres serializa inserciones concurrentes del mismo número.
  const result = await tx.raffleNumber.createMany({
    data: numbers.map((number) => ({
      raffleId,
      number,
      status: "RESERVED" as const,
      orderId,
      reservedUntil,
    })),
    skipDuplicates: true,
  });

  if (result.count !== numbers.length) {
    // Identificar cuáles quedaron por fuera para informar al usuario.
    const mine = await tx.raffleNumber.findMany({
      where: { raffleId, number: { in: numbers }, orderId },
      select: { number: true },
    });
    const held = new Set(mine.map((r) => r.number));
    throw new ClaimConflictError(numbers.filter((n) => !held.has(n)));
  }
}

export type PublicNumberStatus =
  | "DISPONIBLE"
  | "RESERVADO"
  | "VENDIDO"
  | "BLOQUEADO";

/** Estado público de un número concreto — consulta O(1) por índice único. */
export async function getNumberStatus(
  raffleId: string,
  number: number
): Promise<PublicNumberStatus> {
  const row = await prisma.raffleNumber.findUnique({
    where: { raffleId_number: { raffleId, number } },
    select: { status: true, reservedUntil: true },
  });
  if (!row) return "DISPONIBLE";
  if (!isRowAlive(row)) return "DISPONIBLE";
  if (row.status === "PAID") return "VENDIDO";
  if (row.status === "BLOCKED") return "BLOQUEADO";
  return "RESERVADO";
}

/** Estado de varios números en una sola consulta (para verificar selecciones). */
export async function getNumbersStatus(
  raffleId: string,
  numbers: number[]
): Promise<Map<number, PublicNumberStatus>> {
  const rows = await prisma.raffleNumber.findMany({
    where: { raffleId, number: { in: numbers } },
    select: { number: true, status: true, reservedUntil: true },
  });
  const map = new Map<number, PublicNumberStatus>();
  for (const n of numbers) map.set(n, "DISPONIBLE");
  for (const row of rows) {
    if (!isRowAlive(row)) continue;
    map.set(
      row.number,
      row.status === "PAID"
        ? "VENDIDO"
        : row.status === "BLOCKED"
          ? "BLOQUEADO"
          : "RESERVADO"
    );
  }
  return map;
}

function randomCandidates(
  total: number,
  count: number,
  exclude: Set<number>
): number[] {
  const out = new Set<number>();
  const cap = Math.min(count, total);
  let guard = 0;
  while (out.size < cap && guard < count * 30) {
    guard++;
    const n = randomInt(0, total);
    if (!exclude.has(n) && !out.has(n)) out.add(n);
  }
  return [...out];
}

/**
 * Elige números DISPONIBLES al azar (verificado en backend, nunca en el
 * navegador). Estrategia: rondas de candidatos aleatorios filtrados contra
 * la base; para rifas casi agotadas, barrido de ventanas aleatorias con
 * generate_series (sin cargar jamás el universo completo).
 */
export async function pickRandomAvailable(
  raffle: { id: string; totalNumbers: number },
  count: number
): Promise<number[]> {
  const now = new Date();
  const picked = new Set<number>();

  for (let round = 0; round < 6 && picked.size < count; round++) {
    const need = count - picked.size;
    const batch = randomCandidates(
      raffle.totalNumbers,
      Math.min(need * 4 + 16, 2000),
      picked
    );
    if (batch.length === 0) break;
    const taken = await prisma.raffleNumber.findMany({
      where: { raffleId: raffle.id, number: { in: batch } },
      select: { number: true, status: true, reservedUntil: true },
    });
    const alive = new Set(
      taken.filter((r) => isRowAlive(r, now)).map((r) => r.number)
    );
    for (const n of batch) {
      if (picked.size >= count) break;
      if (!alive.has(n)) picked.add(n);
    }
  }

  // Respaldo para rifas con alta ocupación: ventanas aleatorias en SQL.
  const WINDOW = 2000;
  for (let round = 0; round < 8 && picked.size < count; round++) {
    const start = randomInt(0, Math.max(1, raffle.totalNumbers - WINDOW));
    const need = count - picked.size;
    const rows = await prisma.$queryRaw<{ n: number }[]>`
      SELECT s.n::int AS n
      FROM generate_series(${start}, ${Math.min(start + WINDOW, raffle.totalNumbers) - 1}) AS s(n)
      WHERE NOT EXISTS (
        SELECT 1 FROM "RaffleNumber" rn
        WHERE rn."raffleId" = ${raffle.id}
          AND rn."number" = s.n
          AND (rn."status" <> 'RESERVED' OR rn."reservedUntil" > NOW())
      )
      ORDER BY random()
      LIMIT ${need}
    `;
    for (const row of rows) {
      if (picked.size >= count) break;
      if (!picked.has(row.n)) picked.add(row.n);
    }
  }

  return [...picked];
}

/** Números vendidos reales (para el admin; nunca se muestra al público). */
export async function countByStatus(raffleId: string) {
  const now = new Date();
  const [paid, blocked, reservedAlive] = await Promise.all([
    prisma.raffleNumber.count({ where: { raffleId, status: "PAID" } }),
    prisma.raffleNumber.count({ where: { raffleId, status: "BLOCKED" } }),
    prisma.raffleNumber.count({
      where: { raffleId, status: "RESERVED", reservedUntil: { gt: now } },
    }),
  ]);
  return { paid, blocked, reserved: reservedAlive };
}
