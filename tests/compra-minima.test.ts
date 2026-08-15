import { beforeEach, describe, expect, it, vi } from "vitest";
import { raffleSchema, rafflePatchSchema } from "@/lib/validation";

/**
 * Compra mínima por pedido.
 *
 * Lo que se prueba aquí es el lado del SERVIDOR: la interfaz se puede saltar
 * con una petición directa, así que el mínimo tiene que rechazarse en
 * createOrder. La base de datos no se toca: prisma y el motor de reservas van
 * simulados, porque la comprobación ocurre antes de reservar nada.
 */

// Estado compartido con los simulacros (vi.hoisted: las factorías de vi.mock
// se elevan por encima de este archivo y no verían un const normal).
const sim = vi.hoisted(() => ({
  rifa: null as Record<string, unknown> | null,
  ordenCreada: null as Record<string, unknown> | null,
  reclamados: [] as number[],
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    raffle: { findUnique: async () => sim.rifa },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        participant: { upsert: async () => ({ id: "participante-1" }) },
        order: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            sim.ordenCreada = { id: "orden-1", ...data };
            return sim.ordenCreada;
          },
        },
      }),
  },
}));

vi.mock("@/lib/engine/claims", () => ({
  ClaimConflictError: class ClaimConflictError extends Error {
    constructor(public conflicting: number[]) {
      super("Algunos números ya no están disponibles");
    }
  },
  claimNumbers: async (
    _tx: unknown,
    _raffleId: string,
    numbers: number[]
  ) => {
    sim.reclamados = numbers;
  },
  // Aleatorios simulados: siempre hay disponibilidad de sobra.
  pickRandomAvailable: async (_rifa: unknown, count: number) =>
    Array.from({ length: count }, (_, i) => i + 1),
}));

const { createOrder, OrderError } = await import("@/lib/engine/orders");

/** Rifa de prueba con la compra mínima que pida cada caso. */
function rifaCon(minNumbersPerOrder: number) {
  return {
    id: "rifa-1",
    slug: "sorteo-prueba",
    title: "Sorteo de prueba",
    status: "ACTIVE",
    totalNumbers: 10000,
    digits: 4,
    pricePerNumber: 5000,
    reservationMinutes: 10,
    minNumbersPerOrder,
    maxNumbersPerOrder: 100,
  };
}

const comprador = {
  raffleSlug: "sorteo-prueba",
  name: "Ana Pérez",
  phone: "3105490250",
};

/** Lista de números consecutivos para elegir "a mano": (3) → [1, 2, 3]. */
function numerosManuales(cantidad: number): number[] {
  return Array.from({ length: cantidad }, (_, i) => i + 1);
}

beforeEach(() => {
  sim.rifa = null;
  sim.ordenCreada = null;
  sim.reclamados = [];
});

describe("compra mínima en createOrder", () => {
  it("rechaza con 422 un pedido a mano por debajo del mínimo", async () => {
    sim.rifa = rifaCon(25);
    const error = await createOrder({
      ...comprador,
      numbers: numerosManuales(15),
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OrderError);
    expect((error as InstanceType<typeof OrderError>).status).toBe(422);
    expect((error as Error).message).toBe(
      "La compra mínima de este sorteo es de 25 números."
    );
    expect(sim.ordenCreada).toBeNull(); // no se reservó nada
  });

  it("acepta un pedido exactamente igual al mínimo", async () => {
    sim.rifa = rifaCon(25);
    const { order, numbers } = await createOrder({
      ...comprador,
      numbers: numerosManuales(25),
    });

    expect(numbers).toHaveLength(25);
    expect(order.quantity).toBe(25);
    expect(sim.reclamados).toHaveLength(25);
  });

  it("aplica el mínimo también cuando los números se piden al azar", async () => {
    sim.rifa = rifaCon(25);
    const error = await createOrder({ ...comprador, randomCount: 10 }).catch(
      (e: unknown) => e
    );

    expect(error).toBeInstanceOf(OrderError);
    expect((error as InstanceType<typeof OrderError>).status).toBe(422);
    expect((error as Error).message).toBe(
      "La compra mínima de este sorteo es de 25 números."
    );
    expect(sim.ordenCreada).toBeNull();

    // Y con la cantidad justa, el mismo camino sí pasa.
    const { order } = await createOrder({ ...comprador, randomCount: 25 });
    expect(order.quantity).toBe(25);
  });

  it("no deja llegar al mínimo repitiendo el mismo número", async () => {
    sim.rifa = rifaCon(25);
    const error = await createOrder({
      ...comprador,
      numbers: Array.from({ length: 30 }, () => 7),
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(OrderError);
    expect((error as Error).message).toBe(
      "La compra mínima de este sorteo es de 25 números."
    );
  });

  it("con mínimo 1 se puede comprar un solo número", async () => {
    sim.rifa = rifaCon(1);
    const { order } = await createOrder({ ...comprador, numbers: [42] });
    expect(order.quantity).toBe(1);
  });
});

/** Rifa válida mínima para el esquema del panel. */
const rifaBase = {
  title: "Sorteo de prueba",
  slug: "sorteo-prueba",
  prize: "Camioneta",
  pricePerNumber: 5000,
  totalNumbers: 10000,
  status: "ACTIVE" as const,
};

describe("compra mínima en el esquema de la rifa", () => {
  it("por defecto es 1 y admite el valor del panel", () => {
    expect(raffleSchema.parse(rifaBase).minNumbersPerOrder).toBe(1);
    expect(
      raffleSchema.parse({
        ...rifaBase,
        minNumbersPerOrder: 25,
        maxNumbersPerOrder: 100,
      }).minNumbersPerOrder
    ).toBe(25);
  });

  it("rechaza un mínimo mayor que el máximo por pedido", () => {
    const parsed = raffleSchema.safeParse({
      ...rifaBase,
      minNumbersPerOrder: 50,
      maxNumbersPerOrder: 20,
    });
    expect(parsed.success).toBe(false);
    expect(parsed.error?.issues[0]?.message).toContain("compra mínima");
  });

  it("el esquema de edición sigue siendo parcial y valida la pareja", () => {
    // .partial() tuvo que separarse de los refinamientos: esto comprueba que
    // el PATCH sigue aceptando un cambio suelto.
    expect(rafflePatchSchema.safeParse({ title: "Otro título" }).success).toBe(
      true
    );
    expect(
      rafflePatchSchema.safeParse({
        minNumbersPerOrder: 25,
        maxNumbersPerOrder: 100,
      }).success
    ).toBe(true);
    expect(
      rafflePatchSchema.safeParse({
        minNumbersPerOrder: 50,
        maxNumbersPerOrder: 20,
      }).success
    ).toBe(false);
  });
});
