import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  coincideNombre,
  mismoNombre,
  palabrasDeNombre,
  pareceNombre,
} from "@/lib/nombres";

/**
 * «Mis boletas» por NOMBRE (pedido del dueño, 2026-10-10): en las rifas de 2 y
 * 3 cifras se reserva solo con el nombre, así que con el nombre se tienen que
 * poder volver a ver los números. Reglas que se prueban:
 *  1. La comparación no distingue tildes, mayúsculas ni orden, pero va por
 *     palabras enteras: "Juan" no encuentra a "Juana".
 *  2. Por nombre SOLO salen pedidos de rifas de cuadrícula no eliminadas: la
 *     rifa grande (números ocultos hasta el pago) nunca sale por nombre,
 *     aunque esa misma persona haya comprado ahí con su celular.
 *  3. Cada pedido dice a nombre de quién está y nunca viaja el celular.
 */

describe("comparar nombres", () => {
  it("quita tildes, mayúsculas, signos y conectores", () => {
    expect(palabrasDeNombre("  JOSÉ  María de los Ángeles-Muñoz ")).toEqual([
      "jose",
      "maria",
      "angeles",
      "munoz",
    ]);
  });

  it("reconoce cuándo lo escrito es un nombre", () => {
    expect(pareceNombre("Juan Pérez")).toBe(true);
    expect(pareceNombre("Ana")).toBe(true);
    expect(pareceNombre("3001234567")).toBe(false);
    expect(pareceNombre("ABC12345")).toBe(false);
    expect(pareceNombre("juan@gmail.com")).toBe(false);
    // Sin una palabra de 3 letras no identifica a nadie.
    expect(pareceNombre("de la")).toBe(false);
    expect(pareceNombre("Al")).toBe(false);
  });

  it("encuentra el mismo nombre escrito de otra forma", () => {
    expect(coincideNombre("juan perez", "Juan Pérez")).toBe(true);
    expect(coincideNombre("PÉREZ JUAN", "Juan Pérez")).toBe(true);
    expect(coincideNombre("Juan Pérez", "Juan Pérez Gómez")).toBe(true);
    // Reservó solo con "Juan": buscar con el apellido también lo encuentra.
    expect(coincideNombre("Juan Pérez", "Juan")).toBe(true);
    expect(coincideNombre("Munoz", "Muñoz")).toBe(true);
  });

  it("no confunde personas ni pedazos de palabra", () => {
    expect(coincideNombre("Juan Gómez", "Juan Pérez")).toBe(false);
    expect(coincideNombre("Juan", "Juana Ríos")).toBe(false);
    expect(coincideNombre("Ana", "Mariana")).toBe(false);
    expect(coincideNombre("de la", "María de la Cruz")).toBe(false);
  });

  it("mismoNombre agrupa solo el mismo nombre completo", () => {
    expect(mismoNombre("JUAN  PÉREZ", "juan perez")).toBe(true);
    expect(mismoNombre("Juan Pérez", "Juan Pérez Gómez")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// El endpoint, con una base simulada en memoria.
// ---------------------------------------------------------------------------

type Rifa = { id: string; title: string; digits: number; boardMode: boolean; archivedAt: Date | null };
type Persona = { id: string; name: string; phone: string | null; email: string | null; idNumber: string | null };
type Pedido = {
  id: string;
  code: string;
  participantId: string;
  raffleId: string;
  status: string;
  numbersJson: string;
  quantity: number;
  total: number;
  reservedUntil: Date | null;
  createdAt: Date;
  paidAt: Date | null;
};

const base = vi.hoisted(() => {
  const futuro = new Date(Date.now() + 24 * 3600_000);
  const rifas = [
    { id: "r1", title: "130 MIL x 1500", digits: 2, boardMode: true, archivedAt: null },
    { id: "r2", title: "Rifa grande", digits: 4, boardMode: false, archivedAt: null },
    { id: "r3", title: "Cuadrícula eliminada", digits: 2, boardMode: true, archivedAt: new Date() },
  ];
  const personas = [
    { id: "p1", name: "Juan Pérez", phone: null, email: null, idNumber: null },
    { id: "p2", name: "JUAN PEREZ", phone: null, email: null, idNumber: null },
    { id: "p3", name: "Juan Gómez", phone: null, email: null, idNumber: null },
    // Compró solo en la rifa grande: por nombre no puede salir.
    { id: "p4", name: "Juan Pérez", phone: "573001234567", email: null, idNumber: null },
    // Compró en las dos: por nombre sale solo lo de la cuadrícula.
    { id: "p5", name: "Juan Pérez", phone: "573009999999", email: null, idNumber: null },
    { id: "p6", name: "Juan Pérez", phone: null, email: null, idNumber: null },
  ];
  const d = (min: number) => new Date(Date.UTC(2026, 9, 10, 12, min));
  const pedidos = [
    { id: "o1", code: "AAAA0001", participantId: "p1", raffleId: "r1", status: "PENDING", numbersJson: "[7,23]", quantity: 2, total: 3000, reservedUntil: futuro, createdAt: d(1), paidAt: null },
    { id: "o2", code: "AAAA0002", participantId: "p2", raffleId: "r1", status: "PAID", numbersJson: "[45]", quantity: 1, total: 1500, reservedUntil: null, createdAt: d(2), paidAt: d(3) },
    { id: "o3", code: "AAAA0003", participantId: "p3", raffleId: "r1", status: "PENDING", numbersJson: "[8]", quantity: 1, total: 1500, reservedUntil: futuro, createdAt: d(4), paidAt: null },
    { id: "o4", code: "AAAA0004", participantId: "p4", raffleId: "r2", status: "PAID", numbersJson: "[1234]", quantity: 1, total: 5000, reservedUntil: null, createdAt: d(5), paidAt: d(5) },
    { id: "o5", code: "AAAA0005", participantId: "p5", raffleId: "r1", status: "PENDING", numbersJson: "[90]", quantity: 1, total: 1500, reservedUntil: futuro, createdAt: d(6), paidAt: null },
    { id: "o6", code: "AAAA0006", participantId: "p5", raffleId: "r2", status: "PAID", numbersJson: "[4321]", quantity: 1, total: 5000, reservedUntil: null, createdAt: d(7), paidAt: d(7) },
    { id: "o7", code: "AAAA0007", participantId: "p6", raffleId: "r3", status: "PAID", numbersJson: "[11]", quantity: 1, total: 1500, reservedUntil: null, createdAt: d(8), paidAt: d(8) },
  ];
  return { rifas, personas, pedidos };
});

type FiltroRifa = { boardMode?: boolean; archivedAt?: null };
const rifaDe = (p: Pedido) => base.rifas.find((r) => r.id === p.raffleId) as Rifa;
const cumpleRifa = (r: Rifa, f?: FiltroRifa) =>
  !f ||
  ((f.boardMode === undefined || r.boardMode === f.boardMode) &&
    (f.archivedAt === undefined || r.archivedAt === null));

vi.mock("@/lib/db", () => ({
  prisma: {
    order: {
      findUnique: async ({ where }: { where: { code: string } }) =>
        (base.pedidos as Pedido[]).find((p) => p.code === where.code) ?? null,
      findMany: async ({
        where,
      }: {
        where: { OR: { participantId: { in: string[] }; raffle?: FiltroRifa }[] };
      }) =>
        (base.pedidos as Pedido[])
          .filter((p) =>
            where.OR.some(
              (c) => c.participantId.in.includes(p.participantId) && cumpleRifa(rifaDe(p), c.raffle)
            )
          )
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .map((p) => ({
            ...p,
            raffle: { ...rifaDe(p), drawDateText: null },
            participant: {
              name: (base.personas as Persona[]).find((x) => x.id === p.participantId)!.name,
            },
          })),
    },
    participant: {
      findUnique: async ({ where }: { where: { phone: string } }) =>
        (base.personas as Persona[]).find((x) => x.phone === where.phone) ?? null,
      findMany: async ({
        where,
      }: {
        where: { orders?: { some: { raffle: FiltroRifa } }; idNumber?: string; email?: unknown };
      }) => {
        const filtro = where.orders?.some.raffle;
        if (!filtro) return [];
        return (base.personas as Persona[]).filter((x) =>
          (base.pedidos as Pedido[]).some(
            (p) => p.participantId === x.id && cumpleRifa(rifaDe(p), filtro)
          )
        );
      },
    },
  },
}));

const { POST } = await import("@/app/api/public/lookup/route");

let ipLibre = 0;
async function buscar(query: string) {
  // Una IP distinta por consulta: el cupo de intentos no es lo que se prueba.
  ipLibre += 1;
  const req = new NextRequest("http://localhost/api/public/lookup", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": `10.0.0.${ipLibre}` },
    body: JSON.stringify({ query }),
  });
  const res = await POST(req);
  const texto = await res.text();
  return { status: res.status, texto, data: JSON.parse(texto) };
}

describe("Mis boletas por nombre", () => {
  it("encuentra las reservas de la cuadrícula con el nombre, sin tildes ni mayúsculas", async () => {
    const r = await buscar("juan perez");
    expect(r.status).toBe(200);
    const codigos = r.data.orders.map((o: { code: string }) => o.code);
    // o1 (Juan Pérez), o2 (JUAN PEREZ) y o5 (la reserva de cuadrícula de p5).
    expect(codigos.sort()).toEqual(["AAAA0001", "AAAA0002", "AAAA0005"]);
    const o1 = r.data.orders.find((o: { code: string }) => o.code === "AAAA0001");
    expect(o1.numbers).toEqual(["07", "23"]);
    expect(o1.name).toBe("Juan Pérez");
  });

  it("nunca trae la rifa grande ni una cuadrícula eliminada por nombre", async () => {
    const r = await buscar("Juan Pérez");
    const codigos = r.data.orders.map((o: { code: string }) => o.code);
    expect(codigos).not.toContain("AAAA0004");
    expect(codigos).not.toContain("AAAA0006");
    expect(codigos).not.toContain("AAAA0007");
    // Ni el celular de nadie.
    expect(r.texto).not.toContain("57300");
  });

  it("con solo el primer nombre salen todos los Juan, cada uno rotulado", async () => {
    const r = await buscar("Juan");
    const nombres = r.data.orders.map((o: { name: string }) => o.name);
    expect(nombres).toContain("Juan Gómez");
    expect(nombres).toContain("Juan Pérez");
    expect(r.data.orders).toHaveLength(4);
  });

  it("un nombre que no está responde con su propio aviso", async () => {
    const r = await buscar("Pedro Ramírez");
    expect(r.status).toBe(404);
    expect(r.data.error).toContain("nombre");
  });

  it("el celular sigue trayendo la rifa grande como antes", async () => {
    const r = await buscar("300 123 4567");
    expect(r.status).toBe(200);
    expect(r.data.orders.map((o: { code: string }) => o.code)).toEqual(["AAAA0004"]);
  });
});
