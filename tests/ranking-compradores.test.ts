import { describe, expect, it } from "vitest";
import {
  MINIMO_COMPRADORES_RANKING,
  proyectarRanking,
  type TopComprador,
} from "@/lib/public";
import { raffleSchema, rafflePatchSchema } from "@/lib/validation";

/**
 * Ranking público de compradores.
 *
 * Lo que se vigila aquí es lo que puede costar caro: que no se filtre ni un
 * dato personal de más, y que el interruptor de la rifa no se apague solo.
 * La ORDENACIÓN la hace la base de datos; `proyectarRanking` solo numera y
 * abrevia, así que eso es lo que se prueba.
 */

const fila = (participantId: string, quantity: number | null) => ({
  participantId,
  _sum: { quantity },
});

describe("proyección del ranking", () => {
  it("numera las posiciones 1..n respetando el orden recibido", () => {
    const r = proyectarRanking(
      [fila("a", 45), fila("b", 31), fila("c", 22)],
      new Map([
        ["a", "Carmen Rodríguez Pérez"],
        ["b", "Jorge Martínez"],
        ["c", "Luz Ariza"],
      ])
    );
    expect(r.map((x) => x.posicion)).toEqual([1, 2, 3]);
    expect(r.map((x) => x.cantidad)).toEqual([45, 31, 22]);
  });

  it("abrevia el nombre: nunca sale el apellido completo", () => {
    const [uno] = proyectarRanking(
      [fila("a", 10)],
      new Map([["a", "Carmen Rodríguez Pérez"]])
    );
    expect(uno.nombre).toBe("Carmen R. P.");
    expect(uno.nombre).not.toContain("Rodríguez");
    expect(uno.nombre).not.toContain("Pérez");
  });

  it("si falta el nombre no revienta ni pinta un hueco", () => {
    const [uno] = proyectarRanking([fila("fantasma", 5)], new Map());
    expect(uno.nombre).toBe("Participante");
  });

  it("una suma nula cuenta como 0, no como NaN ni null", () => {
    const [uno] = proyectarRanking([fila("a", null)], new Map([["a", "Ana"]]));
    expect(uno.cantidad).toBe(0);
  });

  it("NO se filtra ningún dato personal en la salida", () => {
    const [uno] = proyectarRanking(
      [fila("cmt1szsuy0000jp04vhc1k95w", 7)],
      new Map([["cmt1szsuy0000jp04vhc1k95w", "Daniel Pérez"]])
    );
    // La forma exacta: nada de teléfono, correo, cédula ni el id interno.
    expect(Object.keys(uno).sort()).toEqual([
      "cantidad",
      "nombre",
      "posicion",
    ]);
    expect(JSON.stringify(uno)).not.toContain("cmt1szsuy");
  });

  it("lista vacía devuelve lista vacía", () => {
    expect(proyectarRanking([], new Map())).toEqual([]);
  });

  it("el mínimo de compradores es al menos 3", () => {
    // Con uno o dos nombres el ranking dice que nadie está comprando.
    expect(MINIMO_COMPRADORES_RANKING).toBeGreaterThanOrEqual(3);
  });
});

describe("interruptor showRanking", () => {
  // Rifa válida mínima según raffleSchema: si falta algo, el parse falla y
  // la prueba dejaría de estar comprobando lo que dice comprobar.
  const RIFA_MINIMA = {
    title: "Sorteo de prueba",
    slug: "sorteo-de-prueba",
    prize: "Un millon de pesos",
    pricePerNumber: 2000,
    totalNumbers: 10000,
    status: "DRAFT",
  };

  it("una rifa nueva nace con el ranking APAGADO", () => {
    const r = raffleSchema.safeParse(RIFA_MINIMA);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.showRanking).toBe(false);
  });

  it("un PATCH que no lo menciona NO lo toca", () => {
    // El bug histórico: .partial() conserva los .default(), así que un PATCH
    // de solo {status} salía del validador apagando interruptores ajenos.
    const r = rafflePatchSchema.safeParse({ status: "ACTIVE" });
    expect(r.success).toBe(true);
    if (r.success) expect("showRanking" in r.data).toBe(false);
  });

  it("un false explícito SÍ viaja (no se pierde por ser falso)", () => {
    const r = rafflePatchSchema.safeParse({ showRanking: false });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ showRanking: false });
  });

  it("un true explícito viaja igual", () => {
    const r = rafflePatchSchema.safeParse({ showRanking: true });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toEqual({ showRanking: true });
  });
});
