import { randomInt } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { codigoDeEstado, MAX_NUMEROS_CUADRICULA } from "@/lib/cuadricula";

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
  numbersInput: number[],
  orderId: string,
  reservedUntil: Date
): Promise<void> {
  const now = new Date();
  // Orden determinista (ascendente): dos transacciones que compitan por
  // números solapados los toman en la misma secuencia, evitando deadlocks
  // en el índice único.
  const numbers = [...numbersInput].sort((a, b) => a - b);

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

/**
 * Tablero completo de una rifa de CUADRÍCULA: un carácter por número con su
 * estado (ver src/lib/cuadricula.ts). Consulta EN VIVO, sin caché: lo que el
 * comprador ve en amarillo tiene que estar apartado de verdad.
 *
 * Una reserva vencida cuenta como libre aunque su fila siga en la base
 * (isRowAlive): el barrido de expiración corre una vez al día y, sin esto,
 * un número soltado a las 10 de la mañana seguiría amarillo hasta el día
 * siguiente.
 *
 * Se niega por encima de 1.000 números: la rifa grande jamás publica su
 * inventario entero, ni por error de quien llame a esta función.
 */
export async function getBoardState(
  raffleId: string,
  totalNumbers: number
): Promise<string> {
  if (totalNumbers > MAX_NUMEROS_CUADRICULA) {
    throw new Error("El tablero solo existe para rifas de hasta 1.000 números");
  }
  const now = new Date();
  const filas = await prisma.raffleNumber.findMany({
    where: { raffleId },
    select: { number: true, status: true, reservedUntil: true },
  });
  const casillas: string[] = new Array(totalNumbers).fill(
    codigoDeEstado("libre")
  );
  for (const fila of filas) {
    if (fila.number < 0 || fila.number >= totalNumbers) continue;
    if (!isRowAlive(fila, now)) continue;
    casillas[fila.number] = codigoDeEstado(
      fila.status === "PAID"
        ? "pagado"
        : fila.status === "BLOCKED"
          ? "bloqueado"
          : "reservado"
    );
  }
  return casillas.join("");
}

// Existía un `getNumbersStatus(raffleId, numbers[])` que resolvía el estado de
// varias selecciones de golpe. Nunca se llamó: el comprador consulta de uno en
// uno con el buscador, y quien de verdad arbitra si la selección entera es
// válida es `claimNumbers` dentro de la transacción — comprobarlo antes solo
// habría dado una respuesta que puede quedar obsoleta en el mismo instante.

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

// Aquí estaba `countByStatus(raffleId)`, tres COUNT sueltos por rifa. Quedó sin
// uso: el panel saca esos mismos conteos con un `groupBy` en
// /api/admin/numbers, y el porcentaje público sale del contador atómico
// `paidCount` de la rifa. Dos formas de contar lo mismo acaban discrepando, así
// que se deja una sola.
