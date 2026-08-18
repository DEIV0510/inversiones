import { beforeEach, describe, expect, it, vi } from "vitest";
import { raffleSchema, rafflePatchSchema } from "@/lib/validation";
import { parseTicketPacks, sanearImageAspect } from "@/lib/public";

/**
 * Descuento por paquete de boletas.
 *
 * EL DINERO LO DECIDE EL SERVIDOR: lo que se prueba aquí es que el total de
 * la orden sale de la configuración de la RIFA y no de lo que mande el
 * navegador. La base no se toca (prisma y el motor de reservas van
 * simulados): el precio se calcula antes de reservar nada.
 */

// Estado compartido con los simulacros (vi.hoisted: las factorías de vi.mock
// se elevan por encima de este archivo y no verían un const normal).
const sim = vi.hoisted(() => ({
  rifa: null as Record<string, unknown> | null,
  ordenCreada: null as Record<string, unknown> | null,
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
  claimNumbers: async () => {},
  // Aleatorios simulados: siempre hay disponibilidad de sobra.
  pickRandomAvailable: async (_rifa: unknown, count: number) =>
    Array.from({ length: count }, (_, i) => i + 1),
}));

const { createOrder, calcularTotalPedido } = await import("@/lib/engine/orders");

/** Rifa de prueba con el precio y los paquetes que pida cada caso. */
function rifaCon(pricePerNumber: number, packs: unknown[]) {
  return {
    id: "rifa-1",
    slug: "sorteo-prueba",
    title: "Sorteo de prueba",
    status: "ACTIVE",
    totalNumbers: 10000,
    digits: 4,
    pricePerNumber,
    reservationMinutes: 10,
    minNumbersPerOrder: 1,
    maxNumbersPerOrder: 200,
    ticketPacksJson: JSON.stringify(packs),
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
});

describe("total del pedido en createOrder", () => {
  it("sin descuento cobra cantidad × precio de lista", async () => {
    sim.rifa = rifaCon(5000, [1, 2, 5, 10]);
    const { order } = await createOrder({ ...comprador, randomCount: 10 });

    expect(order.total).toBe(50_000);
    expect(order.unitPrice).toBe(5000);
    expect(order.quantity).toBe(10);
  });

  it("aplica el 10% del paquete cuando la cantidad coincide exactamente", async () => {
    sim.rifa = rifaCon(5000, [
      { q: 25 },
      { q: 55, label: "Más vendido", off: 10 },
    ]);
    const { order } = await createOrder({ ...comprador, randomCount: 55 });

    // 55 × 5.000 = 275.000 → 10% menos = 247.500
    expect(order.total).toBe(247_500);
    // El precio unitario sigue siendo el de LISTA: el comprobante enseña
    // "55 × $5.000" al lado del total y así se ve el ahorro.
    expect(order.unitPrice).toBe(5000);
  });

  it("una cantidad que no es la del paquete paga precio de lista", async () => {
    sim.rifa = rifaCon(5000, [{ q: 55, off: 10 }]);

    const { order: uno } = await createOrder({ ...comprador, randomCount: 54 });
    expect(uno.total).toBe(270_000);

    sim.ordenCreada = null;
    const { order: otro } = await createOrder({ ...comprador, randomCount: 56 });
    expect(otro.total).toBe(280_000);
  });

  it("el descuento también vale si el comprador escogió sus números a mano", async () => {
    // Decisión documentada en calcularTotalPedido: el paquete es una
    // condición de precio por cantidad, no un modo de compra. Quien elige sus
    // 55 números uno por uno paga lo mismo que quien pulsa el botón.
    sim.rifa = rifaCon(5000, [{ q: 55, off: 10 }]);
    const { order } = await createOrder({
      ...comprador,
      numbers: numerosManuales(55),
    });

    expect(order.quantity).toBe(55);
    expect(order.total).toBe(247_500);
  });

  it("ignora el descuento y el total que mande el navegador", async () => {
    // Petición fabricada a mano contra el endpoint: trae su propio descuento,
    // su propio total y hasta un precio unitario. Nada de eso puede tocar el
    // dinero: el total se recalcula desde la rifa.
    sim.rifa = rifaCon(5000, [{ q: 10 }]);
    const peticionMaliciosa = {
      ...comprador,
      randomCount: 10,
      off: 90,
      discountPct: 90,
      total: 1,
      unitPrice: 1,
      ticketPacks: [{ q: 10, off: 90 }],
    } as Parameters<typeof createOrder>[0];

    const { order } = await createOrder(peticionMaliciosa);
    expect(order.total).toBe(50_000);
    expect(order.unitPrice).toBe(5000);
  });

  it("no se cree un descuento corrupto guardado en la rifa", async () => {
    // Fuera de rango o guardado como texto → se cobra el precio de lista.
    sim.rifa = rifaCon(5000, [
      { q: 10, off: 200 },
      { q: 20, off: "50" },
    ]);

    const { order: diez } = await createOrder({ ...comprador, randomCount: 10 });
    expect(diez.total).toBe(50_000);

    sim.ordenCreada = null;
    const { order: veinte } = await createOrder({
      ...comprador,
      randomCount: 20,
    });
    expect(veinte.total).toBe(100_000);
  });
});

describe("cálculo del total (calcularTotalPedido)", () => {
  /** Atajo: total de `cantidad` números con esos paquetes. */
  function total(cantidad: number, precio: number, packs: unknown[]) {
    return calcularTotalPedido({
      cantidad,
      pricePerNumber: precio,
      ticketPacksJson: JSON.stringify(packs),
    });
  }

  it("redondea a peso entero, hacia arriba y hacia abajo", () => {
    // 3 × 1.250 = 3.750 → 7% menos = 3.487,50 → 3.488 (con floor serían
    // 3.487 y el arqueo del dueño no cuadraría con el porcentaje anunciado).
    expect(total(3, 1250, [{ q: 3, off: 7 }]).total).toBe(3488);
    // 5 × 333 = 1.665 → 7% menos = 1.548,45 → 1.548.
    expect(total(5, 333, [{ q: 5, off: 7 }]).total).toBe(1548);
    // Nunca quedan centavos.
    expect(Number.isInteger(total(3, 1250, [{ q: 3, off: 7 }]).total)).toBe(true);
  });

  it("sigue leyendo la forma vieja del JSON", () => {
    // Rifas ya creadas: [1, 2, 5, 10]. Sin etiquetas ni descuentos.
    expect(total(10, 5000, [1, 2, 5, 10])).toEqual({
      total: 50_000,
      discountPct: 0,
    });
    // Y las dos formas pueden convivir en el mismo JSON.
    const mixto = [10, { q: 55, off: 10 }];
    expect(total(10, 5000, mixto).total).toBe(50_000);
    expect(total(55, 5000, mixto).total).toBe(247_500);
  });

  it("con dos paquetes de la misma cantidad se aplica el mayor descuento", () => {
    const repetidos = [
      { q: 25, off: 5 },
      { q: 25, label: "VIP", off: 15 },
    ];
    // 25 × 4.000 = 100.000 → 15% (no 5%) = 85.000
    expect(total(25, 4000, repetidos)).toEqual({
      total: 85_000,
      discountPct: 15,
    });
  });

  it("un JSON corrupto no rompe la compra: se cobra precio de lista", () => {
    expect(
      calcularTotalPedido({
        cantidad: 10,
        pricePerNumber: 5000,
        ticketPacksJson: "esto no es json",
      })
    ).toEqual({ total: 50_000, discountPct: 0 });
  });
});

describe("paquetes en el esquema de la rifa", () => {
  /** Rifa válida mínima para el esquema del panel. */
  const rifaBase = {
    title: "Sorteo de prueba",
    slug: "sorteo-prueba",
    prize: "Camioneta",
    pricePerNumber: 5000,
    totalNumbers: 10000,
    status: "ACTIVE" as const,
  };

  function packs(valor: unknown[]) {
    return raffleSchema.safeParse({ ...rifaBase, ticketPacks: valor });
  }

  it("normaliza la forma vieja a objetos", () => {
    const parsed = packs([1, 2, 5, 10]);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.ticketPacks).toEqual([
      { q: 1 },
      { q: 2 },
      { q: 5 },
      { q: 10 },
    ]);
  });

  it("guarda etiqueta y descuento, y descarta los vacíos", () => {
    const parsed = packs([
      { q: 25, label: "  Recomendado  " },
      { q: 55, label: "Más vendido", off: 10 },
      { q: 75, label: "" },
    ]);
    expect(parsed.success).toBe(true);
    expect(parsed.data?.ticketPacks).toEqual([
      { q: 25, label: "Recomendado" },
      { q: 55, label: "Más vendido", off: 10 },
      { q: 75 },
    ]);
  });

  it("por defecto trae los paquetes de siempre", () => {
    expect(raffleSchema.parse(rifaBase).ticketPacks).toEqual([
      { q: 1 },
      { q: 2 },
      { q: 5 },
      { q: 10 },
    ]);
  });

  it("rechaza cantidades, etiquetas y descuentos fuera de rango", () => {
    expect(packs([{ q: 0 }]).success).toBe(false);
    expect(packs([{ q: 5001 }]).success).toBe(false);
    expect(packs([{ q: 5.5 }]).success).toBe(false);
    expect(packs([{ q: 10, off: 0 }]).success).toBe(false);
    expect(packs([{ q: 10, off: 91 }]).success).toBe(false);
    expect(packs([{ q: 10, off: 10.5 }]).success).toBe(false);
    expect(packs([{ q: 10, label: "x".repeat(25) }]).success).toBe(false);
    expect(packs([{ q: 10, label: "x".repeat(24) }]).success).toBe(true);
  });

  it("el esquema de edición valida los paquetes igual que el de alta", () => {
    // El PATCH del panel manda solo lo que cambió.
    const parsed = rafflePatchSchema.safeParse({
      ticketPacks: [5, { q: 55, label: "Más vendido", off: 10 }],
      imageAspect: "9/16",
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.ticketPacks).toEqual([
      { q: 5 },
      { q: 55, label: "Más vendido", off: 10 },
    ]);
    expect(
      rafflePatchSchema.safeParse({ ticketPacks: [{ q: 5 }, { q: 5 }] }).success
    ).toBe(false);
  });

  it("guarda la proporción de la foto y rechaza las que no existen", () => {
    // Sin elegir nada se queda como estaba: 4/3.
    expect(raffleSchema.parse(rifaBase).imageAspect).toBe("4/3");
    expect(
      raffleSchema.parse({ ...rifaBase, imageAspect: "9/16" }).imageAspect
    ).toBe("9/16");
    expect(
      raffleSchema.safeParse({ ...rifaBase, imageAspect: "16/9" }).success
    ).toBe(false);
  });

  it("no admite dos paquetes con la misma cantidad ni más de 12", () => {
    const repetido = packs([{ q: 25 }, { q: 25, off: 10 }]);
    expect(repetido.success).toBe(false);
    expect(repetido.error?.issues[0]?.message).toBe(
      "Ya hay un paquete de 25 números"
    );
    // La forma vieja repetida también se caza (5 aparece dos veces).
    expect(packs([1, 5, 5]).success).toBe(false);
    expect(
      packs(Array.from({ length: 13 }, (_, i) => ({ q: i + 1 }))).success
    ).toBe(false);
  });
});

describe("paquetes y proporción de la foto en la vista pública", () => {
  it("entrega siempre qty, label y discountPct", () => {
    expect(parseTicketPacks(JSON.stringify([2, { q: 55, off: 10 }]))).toEqual([
      { qty: 2, label: "", discountPct: 0 },
      { qty: 55, label: "", discountPct: 10 },
    ]);
    expect(
      parseTicketPacks(JSON.stringify([{ q: 75, label: "VIP", off: 10 }]))
    ).toEqual([{ qty: 75, label: "VIP", discountPct: 10 }]);
  });

  it("descarta la basura sin romper la página", () => {
    expect(parseTicketPacks("{}")).toEqual([]);
    expect(parseTicketPacks("no es json")).toEqual([]);
    expect(parseTicketPacks(JSON.stringify([null, "5", { q: 0 }, 0]))).toEqual(
      []
    );
    // Como mucho 12 paquetes, aunque la base traiga más.
    expect(
      parseTicketPacks(
        JSON.stringify(Array.from({ length: 20 }, (_, i) => i + 1))
      )
    ).toHaveLength(12);
  });

  it("la proporción de la foto se sanea a un valor conocido", () => {
    expect(sanearImageAspect("9/16")).toBe("9/16");
    expect(sanearImageAspect("1/1")).toBe("1/1");
    expect(sanearImageAspect("4/3")).toBe("4/3");
    // El dueño habló de "16/9" en su nota de voz, pero no es un valor
    // guardado: cualquier cosa rara vuelve a la proporción de siempre.
    expect(sanearImageAspect("16/9")).toBe("4/3");
    expect(sanearImageAspect(null)).toBe("4/3");
    expect(sanearImageAspect("")).toBe("4/3");
  });
});
