import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AJUSTES_FORZADOS_CUADRICULA,
  cifrasDeCuadricula,
  errorCuadricula,
  leerCasilla,
  MAX_NUMEROS_CUADRICULA,
  tableroValido,
} from "@/lib/cuadricula";
import { orderWhatsAppMessage, reservaWhatsAppMessage } from "@/lib/notifications";

/**
 * Rifas de CUADRÍCULA (2 y 3 cifras): el comprador escoge sobre el tablero,
 * RESERVA solo con su nombre y el pedido le llega al dueño por WhatsApp con
 * los números a la vista.
 *
 * Lo que se prueba es el lado del SERVIDOR y las reglas puras: la interfaz se
 * puede saltar con una petición directa. La base de datos no se toca: prisma
 * y el motor de reservas van simulados.
 */

const sim = vi.hoisted(() => ({
  rifa: null as Record<string, unknown> | null,
  ordenCreada: null as Record<string, unknown> | null,
  reclamados: [] as number[],
  upserts: [] as Record<string, unknown>[],
  creados: [] as Record<string, unknown>[],
  confirmaciones: 0,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    raffle: { findUnique: async () => sim.rifa },
    $transaction: async (fn: (tx: unknown) => unknown) =>
      fn({
        participant: {
          upsert: async (args: Record<string, unknown>) => {
            sim.upserts.push(args);
            return { id: "participante-con-celular" };
          },
          create: async (args: Record<string, unknown>) => {
            sim.creados.push(args);
            return { id: `participante-nuevo-${sim.creados.length}` };
          },
        },
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
  claimNumbers: async (_tx: unknown, _raffleId: string, numbers: number[]) => {
    sim.reclamados = numbers;
  },
  pickRandomAvailable: async (_rifa: unknown, count: number) =>
    Array.from({ length: count }, (_, i) => i + 1),
}));

const { createOrder, createManualOrder, OrderError } = await import(
  "@/lib/engine/orders"
);

/** Rifa de cuadrícula 00-99 que reserva solo con el nombre. */
function cuadricula(extra: Record<string, unknown> = {}) {
  return {
    id: "rifa-cuadricula",
    slug: "rifa-100",
    title: "Rifa 100 mil",
    status: "ACTIVE",
    totalNumbers: 100,
    digits: 2,
    pricePerNumber: 5000,
    reservationMinutes: 1440,
    minNumbersPerOrder: 1,
    maxNumbersPerOrder: 10,
    ticketPacksJson: "[]",
    boardMode: true,
    whatsappCheckout: true,
    gatewayCheckout: false,
    askPhone: false,
    askIdNumber: false,
    askEmail: false,
    askCity: false,
    ...extra,
  };
}

beforeEach(() => {
  sim.rifa = null;
  sim.ordenCreada = null;
  sim.reclamados = [];
  sim.upserts = [];
  sim.creados = [];
  sim.confirmaciones = 0;
});

describe("reglas de la cuadrícula", () => {
  it("las cifras salen justas: 100 → 2, 1000 → 3, 50 → 2", () => {
    expect(cifrasDeCuadricula(100)).toBe(2);
    expect(cifrasDeCuadricula(1000)).toBe(3);
    expect(cifrasDeCuadricula(50)).toBe(2);
    expect(cifrasDeCuadricula(10)).toBe(2);
  });

  it("no admite más de 1.000 números", () => {
    expect(
      errorCuadricula({ boardMode: true, totalNumbers: 10000, digits: 4 })
    ).toMatch(/1\.000/);
    expect(MAX_NUMEROS_CUADRICULA).toBe(1000);
  });

  it("100 números con 4 cifras (0000-0099) no es una rifa de 2 cifras", () => {
    expect(
      errorCuadricula({ boardMode: true, totalNumbers: 100, digits: 4 })
    ).toMatch(/2 cifras/);
    expect(
      errorCuadricula({ boardMode: true, totalNumbers: 100, digits: 2 })
    ).toBeNull();
    expect(
      errorCuadricula({ boardMode: true, totalNumbers: 1000, digits: 3 })
    ).toBeNull();
  });

  it("una rifa que no es de cuadrícula no tiene estas reglas", () => {
    expect(
      errorCuadricula({ boardMode: false, totalNumbers: 10000, digits: 4 })
    ).toBeNull();
  });

  it("la cuadrícula siempre escoge a mano, cierra por WhatsApp y sin pasarela", () => {
    expect(AJUSTES_FORZADOS_CUADRICULA).toEqual({
      selectionMode: "MANUAL",
      whatsappCheckout: true,
      gatewayCheckout: false,
    });
  });

  it("lee las casillas del tablero", () => {
    const tablero = "0123" + "0".repeat(96);
    expect(leerCasilla(tablero, 0)).toBe("libre");
    expect(leerCasilla(tablero, 1)).toBe("reservado");
    expect(leerCasilla(tablero, 2)).toBe("pagado");
    expect(leerCasilla(tablero, 3)).toBe("bloqueado");
    // Fuera del tablero no se inventa nada.
    expect(leerCasilla(tablero, 500)).toBe("libre");
    expect(tableroValido(tablero, 100)).toBe(true);
    expect(tableroValido(tablero, 1000)).toBe(false);
    expect(tableroValido("01x" + "0".repeat(97), 100)).toBe(false);
    expect(tableroValido(null, 100)).toBe(false);
  });
});

describe("mensajes de WhatsApp", () => {
  it("la reserva lleva nombre, números con ceros, total y código", () => {
    const url = reservaWhatsAppMessage({
      businessPhone: "573106930187",
      participantName: "Carmen Ruiz",
      raffleTitle: "Rifa 100 mil",
      orderCode: "ABCD2345",
      numbers: ["07", "23", "58"],
      total: 15000,
    });
    expect(url.startsWith("https://wa.me/573106930187?text=")).toBe(true);
    const texto = decodeURIComponent(url.split("?text=")[1]);
    expect(texto).toContain("Carmen Ruiz");
    expect(texto).toContain("07, 23, 58");
    expect(texto).toContain("ABCD2345");
    expect(texto).toContain("15.000");
    // Se reserva, no se compra.
    expect(texto.toLowerCase()).toContain("reservar");
    expect(texto.toLowerCase()).not.toContain("comprar");
  });

  it("los caracteres raros del nombre viajan codificados", () => {
    const url = reservaWhatsAppMessage({
      businessPhone: "573106930187",
      participantName: "Ana & José",
      raffleTitle: "Rifa #1",
      orderCode: "ABCD2345",
      numbers: ["007"],
      total: 2000,
    });
    const consulta = url.split("?text=")[1];
    expect(consulta).not.toContain(" ");
    expect(consulta).not.toContain("&");
    expect(consulta).not.toContain("#");
    expect(decodeURIComponent(consulta)).toContain("el número: 007");
  });

  it("REGRESIÓN: el mensaje de la rifa grande sin pagar NO lleva los números", () => {
    const url = orderWhatsAppMessage({
      businessPhone: "573106930187",
      participantName: "Juan Perez",
      raffleTitle: "5 millones",
      orderCode: "ZXCV6789",
      quantity: 3,
      total: 6000,
    });
    const texto = decodeURIComponent(url.split("?text=")[1]);
    expect(texto).toContain("ZXCV6789");
    expect(texto).toContain("3 números");
    expect(texto).not.toMatch(/\b\d{4}\b(?!\d)/);
  });
});

describe("reservar en una cuadrícula (createOrder)", () => {
  it("reserva solo con el nombre y crea un participante NUEVO sin celular", async () => {
    sim.rifa = cuadricula();
    const { order } = await createOrder({
      raffleSlug: "rifa-100",
      name: "Carmen Ruiz",
      numbers: [23, 7],
    });
    expect(sim.upserts).toHaveLength(0);
    expect(sim.creados).toHaveLength(1);
    expect(
      (sim.creados[0].data as Record<string, unknown>).phone
    ).toBeNull();
    expect(sim.reclamados).toEqual([7, 23]);
    expect(order.total).toBe(10000);
    expect(order.status).toBe("PENDING");
  });

  it("dos reservas sin celular NO se funden en un solo participante", async () => {
    sim.rifa = cuadricula();
    await createOrder({ raffleSlug: "rifa-100", name: "Juan Pérez", numbers: [1] });
    await createOrder({ raffleSlug: "rifa-100", name: "Juan Pérez", numbers: [2] });
    expect(sim.creados).toHaveLength(2);
    expect(sim.upserts).toHaveLength(0);
  });

  it("un celular colado en una rifa que no lo pide se descarta", async () => {
    sim.rifa = cuadricula();
    await createOrder({
      raffleSlug: "rifa-100",
      name: "Carmen Ruiz",
      phone: "3106930187",
      numbers: [5],
    });
    // Si se usara, el upsert por celular le cambiaría el nombre al dueño de
    // ese número.
    expect(sim.upserts).toHaveLength(0);
    expect(sim.creados).toHaveLength(1);
  });

  it("rechaza números al azar: en la cuadrícula se escoge en el tablero", async () => {
    sim.rifa = cuadricula();
    const error = await createOrder({
      raffleSlug: "rifa-100",
      name: "Carmen Ruiz",
      randomCount: 3,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(OrderError);
    expect(error.message).toMatch(/tablero/);
    expect(sim.ordenCreada).toBeNull();
  });

  it("si la cuadrícula pide celular, lo exige y lo usa", async () => {
    sim.rifa = cuadricula({ askPhone: true });
    const sinCelular = await createOrder({
      raffleSlug: "rifa-100",
      name: "Carmen Ruiz",
      numbers: [5],
    }).catch((e) => e);
    expect(sinCelular).toBeInstanceOf(OrderError);

    await createOrder({
      raffleSlug: "rifa-100",
      name: "Carmen Ruiz",
      phone: "310 693 0187",
      numbers: [5],
    });
    expect(sim.upserts).toHaveLength(1);
    expect(
      (sim.upserts[0].where as Record<string, unknown>).phone
    ).toBe("573106930187");
  });

  it("habla de reserva, no de compra, en sus mensajes", async () => {
    sim.rifa = cuadricula({ minNumbersPerOrder: 3 });
    const error = await createOrder({
      raffleSlug: "rifa-100",
      name: "Carmen Ruiz",
      numbers: [1],
    }).catch((e) => e);
    expect(error).toBeInstanceOf(OrderError);
    expect(error.message).toContain("reserva mínima");
  });

  it("la rifa grande sigue pidiendo celular y cédula", async () => {
    sim.rifa = cuadricula({
      boardMode: false,
      askPhone: true,
      askIdNumber: true,
      askEmail: true,
      askCity: true,
      totalNumbers: 10000,
      digits: 4,
      gatewayCheckout: true,
      whatsappCheckout: false,
    });
    const sinNada = await createOrder({
      raffleSlug: "rifa-100",
      name: "Juan Perez",
      randomCount: 2,
    }).catch((e) => e);
    expect(sinNada).toBeInstanceOf(OrderError);

    const sinCedula = await createOrder({
      raffleSlug: "rifa-100",
      name: "Juan Perez",
      phone: "3106930187",
      randomCount: 2,
    }).catch((e) => e);
    expect(sinCedula).toBeInstanceOf(OrderError);
    expect(sinCedula.message).toContain("cédula");
    expect(sim.ordenCreada).toBeNull();
  });
});

describe("apartar a mano desde el panel (createManualOrder)", () => {
  it("solo en rifas de cuadrícula", async () => {
    sim.rifa = cuadricula({ boardMode: false });
    const error = await createManualOrder({
      raffleId: "rifa-cuadricula",
      numbers: [1],
      name: "Carmen Ruiz",
      markPaid: false,
    }).catch((e) => e);
    expect(error).toBeInstanceOf(OrderError);
    expect(sim.ordenCreada).toBeNull();
  });

  it("no en una rifa finalizada o cancelada", async () => {
    for (const status of ["FINISHED", "CANCELLED"]) {
      sim.rifa = cuadricula({ status });
      const error = await createManualOrder({
        raffleId: "rifa-cuadricula",
        numbers: [1],
        name: "Carmen Ruiz",
        markPaid: false,
      }).catch((e) => e);
      expect(error).toBeInstanceOf(OrderError);
    }
  });

  it("aparta sin tope por pedido y sin celular, en amarillo", async () => {
    sim.rifa = cuadricula({ maxNumbersPerOrder: 2 });
    const { order, numbers, confirmado } = await createManualOrder({
      raffleId: "rifa-cuadricula",
      numbers: [9, 3, 3, 40, 12],
      name: "Carmen Ruiz",
      markPaid: false,
    });
    expect(numbers).toEqual([3, 9, 12, 40]);
    expect(sim.reclamados).toEqual([3, 9, 12, 40]);
    expect(order.status).toBe("PENDING");
    expect(confirmado).toBe(false);
    expect(sim.creados).toHaveLength(1);
  });

  it("rechaza un número fuera del tablero y un celular mal escrito", async () => {
    sim.rifa = cuadricula();
    const fuera = await createManualOrder({
      raffleId: "rifa-cuadricula",
      numbers: [100],
      name: "Carmen Ruiz",
      markPaid: false,
    }).catch((e) => e);
    expect(fuera).toBeInstanceOf(OrderError);

    const celular = await createManualOrder({
      raffleId: "rifa-cuadricula",
      numbers: [1],
      name: "Carmen Ruiz",
      phone: "12",
      markPaid: false,
    }).catch((e) => e);
    expect(celular).toBeInstanceOf(OrderError);
    expect(sim.ordenCreada).toBeNull();
  });
});
