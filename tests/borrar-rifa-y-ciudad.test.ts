import { describe, expect, it } from "vitest";
import { createOrderSchema } from "@/lib/validation";

/**
 * Ciudad del comprador: dato OPCIONAL que pidió el dueño para saber desde
 * dónde le compran. Nunca sale al público (el ranking solo publica nombre
 * abreviado y cantidad).
 */

const BASE = {
  raffleSlug: "sorteo",
  name: "Juan Perez",
  phone: "3106930187",
  idNumber: "1012345678",
  randomCount: 1,
};

describe("ciudad o municipio", () => {
  it("un pedido SIN ciudad se acepta igual", () => {
    expect(createOrderSchema.safeParse(BASE).success).toBe(true);
  });

  it("una ciudad vacía se acepta (es como no ponerla)", () => {
    expect(createOrderSchema.safeParse({ ...BASE, city: "" }).success).toBe(true);
  });

  it("una ciudad normal se acepta y llega limpia", () => {
    const r = createOrderSchema.safeParse({ ...BASE, city: "  Sincelejo  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.city).toBe("Sincelejo");
  });

  it("una ciudad absurdamente larga se rechaza", () => {
    const r = createOrderSchema.safeParse({ ...BASE, city: "a".repeat(200) });
    expect(r.success).toBe(false);
  });

  it("el resto de campos no cambia de obligatoriedad por añadir ciudad", () => {
    // La cédula sigue obligatoria y el correo sigue opcional.
    const sinCedula = { ...BASE, city: "Sincelejo" };
    delete (sinCedula as Record<string, unknown>).idNumber;
    expect(createOrderSchema.safeParse(sinCedula).success).toBe(false);
    expect(
      createOrderSchema.safeParse({ ...BASE, city: "Sincelejo", email: "" })
        .success
    ).toBe(true);
  });
});
