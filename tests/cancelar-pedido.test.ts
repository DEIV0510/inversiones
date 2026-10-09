import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Cancelar un pedido desde el panel (cancelOrder).
 *
 * Dos reglas que se prueban aquí, con la base simulada:
 *  1. Un pago MANUAL es solo la constancia del dueño: si anula la venta, el
 *     pago queda "Anulado". Uno de PASARELA no se toca (ese dinero entró).
 *  2. Una rifa de CUADRÍCULA agotada vuelve a venderse al anular una venta;
 *     la rifa grande no cambia de estado sola.
 */

const sim = vi.hoisted(() => ({
  pedido: null as Record<string, unknown> | null,
  rifaTrasDescontar: null as Record<string, unknown> | null,
  pagosAnulados: [] as Record<string, unknown>[],
  rifaActualizada: [] as Record<string, unknown>[],
}));

vi.mock("@/lib/db", () => {
  const tx = {
    $queryRaw: async () => [],
    order: {
      findUnique: async () => sim.pedido,
      update: async ({ data }: { data: Record<string, unknown> }) => ({ ...sim.pedido, ...data }),
    },
    raffleNumber: { deleteMany: async () => ({ count: 0 }) },
    prizedNumber: { updateMany: async () => ({ count: 0 }) },
    payment: {
      updateMany: async (args: Record<string, unknown>) => {
        sim.pagosAnulados.push(args);
        return { count: 1 };
      },
    },
    raffle: {
      update: async (args: { data: Record<string, unknown> }) => {
        sim.rifaActualizada.push(args.data);
        return sim.rifaTrasDescontar;
      },
    },
  };
  return { prisma: { $transaction: async (fn: (t: unknown) => unknown) => fn(tx) } };
});

const { cancelOrder } = await import("@/lib/engine/orders");

beforeEach(() => {
  sim.pedido = null;
  sim.rifaTrasDescontar = null;
  sim.pagosAnulados = [];
  sim.rifaActualizada = [];
});

describe("cancelar un pedido", () => {
  it("anula SOLO los pagos manuales aprobados del pedido", async () => {
    sim.pedido = { id: "p1", raffleId: "r1", status: "PAID", quantity: 2 };
    sim.rifaTrasDescontar = { id: "r1", boardMode: false, status: "ACTIVE", paidCount: 10, totalNumbers: 10000 };
    await cancelOrder("p1");
    expect(sim.pagosAnulados).toEqual([
      {
        where: { orderId: "p1", provider: "manual", status: "APPROVED" },
        data: { status: "VOIDED" },
      },
    ]);
  });

  it("una cuadrícula agotada vuelve a ACTIVA al anular una venta", async () => {
    sim.pedido = { id: "p2", raffleId: "r2", status: "PAID", quantity: 1 };
    sim.rifaTrasDescontar = { id: "r2", boardMode: true, status: "SOLD_OUT", paidCount: 99, totalNumbers: 100 };
    await cancelOrder("p2");
    expect(sim.rifaActualizada).toContainEqual({ status: "ACTIVE" });
  });

  it("la rifa grande agotada NO cambia de estado sola", async () => {
    sim.pedido = { id: "p3", raffleId: "r3", status: "PAID", quantity: 1 };
    sim.rifaTrasDescontar = { id: "r3", boardMode: false, status: "SOLD_OUT", paidCount: 9999, totalNumbers: 10000 };
    await cancelOrder("p3");
    expect(sim.rifaActualizada).not.toContainEqual({ status: "ACTIVE" });
  });

  it("un pedido ya cancelado no se toca dos veces", async () => {
    sim.pedido = { id: "p4", raffleId: "r4", status: "CANCELLED", quantity: 3 };
    await cancelOrder("p4");
    expect(sim.pagosAnulados).toHaveLength(0);
    expect(sim.rifaActualizada).toHaveLength(0);
  });
});
