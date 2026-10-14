import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Números SUELTOS de un pedido desde el tablero del dueño (pedido del cliente,
 * 2026-10-14: "alguien coge 10 números y dice déjame 8"; y "toco el número y
 * se lo pongo a nombre de otra persona ahí mismo").
 *
 *  1. Soltar uno deja el resto del pedido intacto y recalcula el total.
 *  2. Soltar el último anula el pedido.
 *  3. En un pedido pagado a mano baja el contador de vendidos y la constancia
 *     del pago; uno pagado en línea no se toca.
 *  4. Una reserva vencida no se toca (sus números ya están libres).
 *  5. Pasar a otra persona crea un pedido nuevo con esos números, en la misma
 *     transacción, y si se pide, pagado.
 */

type Fila = { raffleId: string; number: number; status: string; orderId: string | null; reservedUntil: Date | null };
type Estado = {
  rifa: Record<string, unknown>;
  pedidos: Record<string, Record<string, unknown>>;
  filas: Fila[];
  pagos: Record<string, unknown>[];
  personas: Record<string, unknown>[];
};

const sim = vi.hoisted(() => ({ estado: null as unknown as Estado, seq: 0 }));

vi.mock("@/lib/db", () => {
  const e = () => sim.estado;
  const conRifa = (p: Record<string, unknown>) => ({
    ...p,
    raffle: e().rifa,
    participant: e().personas.find((x) => x.id === p.participantId) ?? { name: "?", email: null },
    payments: e().pagos.filter((x) => x.orderId === p.id),
  });
  const coincidePago = (pago: Record<string, unknown>, w: Record<string, unknown>) =>
    Object.entries(w).every(([k, v]) => pago[k] === v);
  const tx = {
    $queryRaw: async () => [],
    order: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const p = e().pedidos[where.id];
        return p ? conRifa(p) : null;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        Object.assign(e().pedidos[where.id], data);
        return { ...e().pedidos[where.id] };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = `nuevo${++sim.seq}`;
        e().pedidos[id] = { id, ...data };
        return { ...e().pedidos[id] };
      },
    },
    raffleNumber: {
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const enLista = (where.number as { in: number[] } | undefined)?.in;
        const antes = e().filas.length;
        e().filas = e().filas.filter((f) => {
          if (where.orderId !== undefined && f.orderId !== where.orderId) return true;
          if (enLista && !enLista.includes(f.number)) return true;
          if (where.status !== undefined && f.status !== where.status) return true;
          if (where.reservedUntil !== undefined) {
            const lt = (where.reservedUntil as { lt: Date }).lt;
            if (!(f.reservedUntil && f.reservedUntil < lt)) return true;
          }
          return false;
        });
        return { count: antes - e().filas.length };
      },
      createMany: async ({ data }: { data: Fila[] }) => {
        let count = 0;
        for (const f of data) {
          if (e().filas.some((x) => x.raffleId === f.raffleId && x.number === f.number)) continue;
          e().filas.push({ ...f });
          count++;
        }
        return { count };
      },
      findMany: async ({ where }: { where: { orderId: string } }) =>
        e().filas.filter((f) => f.orderId === where.orderId),
      updateMany: async ({ where, data }: { where: { orderId: string; status: string }; data: Partial<Fila> }) => {
        let count = 0;
        for (const f of e().filas) {
          if (f.orderId === where.orderId && f.status === where.status) {
            Object.assign(f, data);
            count++;
          }
        }
        return { count };
      },
    },
    prizedNumber: { updateMany: async () => ({ count: 0 }) },
    payment: {
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        let count = 0;
        for (const p of e().pagos) {
          if (coincidePago(p, where)) {
            Object.assign(p, data);
            count++;
          }
        }
        return { count };
      },
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        e().pagos.push({ ...create });
        return create;
      },
    },
    raffle: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        const r = e().rifa as Record<string, number | string>;
        const pc = data.paidCount as { decrement?: number; increment?: number } | undefined;
        if (pc?.decrement) r.paidCount = (r.paidCount as number) - pc.decrement;
        if (pc?.increment) r.paidCount = (r.paidCount as number) + pc.increment;
        if (typeof data.status === "string") r.status = data.status;
        return { ...r };
      },
    },
    participant: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const p = { id: `persona${++sim.seq}`, ...data };
        e().personas.push(p);
        return p;
      },
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        const p = { id: `persona${++sim.seq}`, ...create };
        e().personas.push(p);
        return p;
      },
    },
  };
  return {
    prisma: {
      // Transacción de verdad en miniatura: si algo lanza, el estado vuelve a
      // como estaba (es lo que garantiza que "pasar" nunca deje un número a
      // medio camino).
      $transaction: async (fn: (t: unknown) => unknown) => {
        const copia = structuredClone(sim.estado);
        try {
          return await fn(tx);
        } catch (err) {
          sim.estado = copia;
          throw err;
        }
      },
    },
  };
});

const { releaseOrderNumbers, moveOrderNumbers } = await import("@/lib/engine/orders");

const futuro = () => new Date(Date.now() + 3 * 3600_000);

function rifaCuadricula(extra: Record<string, unknown> = {}) {
  return {
    id: "r1",
    boardMode: true,
    status: "ACTIVE",
    paidCount: 0,
    totalNumbers: 100,
    pricePerNumber: 1500,
    reservationMinutes: 180,
    ticketPacksJson: "[]",
    title: "130 MIL",
    digits: 2,
    ...extra,
  };
}

/** Pedido de 10 números (00-09) de Fatima, reservado o pagado. */
function pedidoDeDiez(status: "PENDING" | "PAID", vence = futuro()) {
  const numeros = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  sim.estado.pedidos.p1 = {
    id: "p1",
    code: "FATIMA10",
    raffleId: "r1",
    participantId: "fatima",
    numbersJson: JSON.stringify(numeros),
    quantity: 10,
    unitPrice: 1500,
    total: 15000,
    status,
    reservedUntil: status === "PENDING" ? vence : null,
  };
  sim.estado.personas.push({ id: "fatima", name: "Fatima", phone: null });
  for (const n of numeros) {
    sim.estado.filas.push({
      raffleId: "r1",
      number: n,
      status: status === "PAID" ? "PAID" : "RESERVED",
      orderId: "p1",
      reservedUntil: status === "PENDING" ? vence : null,
    });
  }
}

const numerosDe = (id: string) => JSON.parse(sim.estado.pedidos[id].numbersJson as string);
const filaDe = (n: number) => sim.estado.filas.find((f) => f.number === n);

beforeEach(() => {
  sim.seq = 0;
  sim.estado = { rifa: rifaCuadricula(), pedidos: {}, filas: [], pagos: [], personas: [] };
});

describe("liberar números sueltos", () => {
  it("«déjame 8 de los 10»: suelta dos, el resto sigue y el total baja", async () => {
    pedidoDeDiez("PENDING");
    const r = await releaseOrderNumbers("p1", [3, 7]);
    expect(r.quedan).toEqual([0, 1, 2, 4, 5, 6, 8, 9]);
    expect(numerosDe("p1")).toEqual([0, 1, 2, 4, 5, 6, 8, 9]);
    expect(sim.estado.pedidos.p1.quantity).toBe(8);
    expect(sim.estado.pedidos.p1.total).toBe(12000);
    expect(sim.estado.pedidos.p1.status).toBe("PENDING");
    expect(filaDe(3)).toBeUndefined();
    expect(filaDe(7)).toBeUndefined();
    expect(filaDe(4)?.orderId).toBe("p1");
  });

  it("soltar el último número anula el pedido", async () => {
    pedidoDeDiez("PENDING");
    await releaseOrderNumbers("p1", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(sim.estado.pedidos.p1.status).toBe("CANCELLED");
    expect(sim.estado.filas).toHaveLength(0);
  });

  it("en un pedido pagado a mano baja el contador y la constancia del pago", async () => {
    sim.estado.rifa = rifaCuadricula({ paidCount: 100, status: "SOLD_OUT" });
    pedidoDeDiez("PAID");
    sim.estado.pagos.push({ orderId: "p1", provider: "manual", status: "APPROVED", amount: 15000 });
    await releaseOrderNumbers("p1", [9]);
    expect(sim.estado.rifa.paidCount).toBe(99);
    // La cuadrícula agotada vuelve a venderse: el 09 quedó libre.
    expect(sim.estado.rifa.status).toBe("ACTIVE");
    expect(sim.estado.pagos[0].amount).toBe(13500);
    expect(sim.estado.pedidos.p1.total).toBe(13500);
  });

  it("un pedido pagado en línea no se toca desde el tablero", async () => {
    pedidoDeDiez("PAID");
    sim.estado.pagos.push({ orderId: "p1", provider: "bold", status: "APPROVED", amount: 15000 });
    await expect(releaseOrderNumbers("p1", [9])).rejects.toThrow(/en línea/);
    expect(numerosDe("p1")).toHaveLength(10);
  });

  it("una reserva vencida no se toca", async () => {
    pedidoDeDiez("PENDING", new Date(Date.now() - 60_000));
    await expect(releaseOrderNumbers("p1", [3])).rejects.toThrow(/venció/);
  });

  it("un número que no es del pedido no se suelta", async () => {
    pedidoDeDiez("PENDING");
    await expect(releaseOrderNumbers("p1", [42])).rejects.toThrow(/no es de este pedido/);
    expect(numerosDe("p1")).toHaveLength(10);
  });

  it("solo en rifas de cuadrícula", async () => {
    sim.estado.rifa = rifaCuadricula({ boardMode: false });
    pedidoDeDiez("PENDING");
    await expect(releaseOrderNumbers("p1", [3])).rejects.toThrow(/cuadrícula/);
  });
});

describe("pasar números a otra persona", () => {
  it("el número sale del pedido de origen y queda reservado a nombre del otro", async () => {
    pedidoDeDiez("PENDING");
    const r = await moveOrderNumbers({ orderId: "p1", numbers: [5], name: "Yuri", markPaid: false });
    expect(numerosDe("p1")).not.toContain(5);
    expect(sim.estado.pedidos.p1.total).toBe(13500);
    const destino = sim.estado.pedidos[r.destino.id];
    expect(JSON.parse(destino.numbersJson as string)).toEqual([5]);
    expect(destino.status).toBe("PENDING");
    expect(filaDe(5)?.orderId).toBe(r.destino.id);
    expect(sim.estado.personas.some((p) => p.name === "Yuri")).toBe(true);
    expect(r.confirmado).toBe(false);
  });

  it("si ya pagó, el pedido nuevo queda pagado y el contador cuadra", async () => {
    sim.estado.rifa = rifaCuadricula({ paidCount: 10 });
    pedidoDeDiez("PAID");
    sim.estado.pagos.push({ orderId: "p1", provider: "manual", status: "APPROVED", amount: 15000 });
    const r = await moveOrderNumbers({ orderId: "p1", numbers: [0, 1], name: "Liliana", markPaid: true });
    expect(r.confirmado).toBe(true);
    expect(sim.estado.pedidos[r.destino.id].status).toBe("PAID");
    expect(filaDe(0)?.status).toBe("PAID");
    // 10 vendidos antes, 10 después: dos pasaron de Fatima a Liliana.
    expect(sim.estado.rifa.paidCount).toBe(10);
  });

  it("si algo falla, no se pierde nada: el número sigue en el pedido de origen", async () => {
    sim.estado.rifa = rifaCuadricula({ status: "FINISHED" });
    pedidoDeDiez("PENDING");
    await expect(
      moveOrderNumbers({ orderId: "p1", numbers: [5], name: "Yuri", markPaid: false })
    ).rejects.toThrow(/ya no está en venta/);
    expect(numerosDe("p1")).toContain(5);
    expect(filaDe(5)?.orderId).toBe("p1");
  });

  it("pide el nombre de la otra persona", async () => {
    pedidoDeDiez("PENDING");
    await expect(
      moveOrderNumbers({ orderId: "p1", numbers: [5], name: " ", markPaid: false })
    ).rejects.toThrow(/nombre/);
  });
});
