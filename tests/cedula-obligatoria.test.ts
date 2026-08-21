import { describe, expect, it } from "vitest";
import { createOrderSchema } from "@/lib/validation";

/**
 * La cédula pasó a ser OBLIGATORIA en el checkout: el dueño quiere poder
 * identificar al ganador con nombre + cédula + celular, y le sirve al
 * comprador para encontrar sus boletas. El correo, en cambio, sigue siendo
 * opcional: mucha gente no tiene o lo escribe mal.
 *
 * Esto se prueba contra el ESQUEMA DEL SERVIDOR a propósito. La validación
 * del formulario es una cortesía para el comprador; la que de verdad manda es
 * esta, porque cualquiera puede llamar al API sin pasar por la pantalla.
 */

const BASE = {
  raffleSlug: "sorteo",
  name: "Juan Perez",
  phone: "3106930187",
  randomCount: 1,
};

describe("cédula obligatoria", () => {
  it("un pedido sin cédula se rechaza", () => {
    const r = createOrderSchema.safeParse(BASE);
    expect(r.success).toBe(false);
  });

  it("una cédula vacía se rechaza", () => {
    const r = createOrderSchema.safeParse({ ...BASE, idNumber: "" });
    expect(r.success).toBe(false);
  });

  it("una cédula demasiado corta se rechaza", () => {
    const r = createOrderSchema.safeParse({ ...BASE, idNumber: "123" });
    expect(r.success).toBe(false);
  });

  it("acepta la cédula con puntos y espacios, y guarda solo dígitos", () => {
    const r = createOrderSchema.safeParse({ ...BASE, idNumber: "12.345.678" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.idNumber).toBe("12345678");

    const r2 = createOrderSchema.safeParse({ ...BASE, idNumber: "12 345 678" });
    expect(r2.success).toBe(true);
    if (r2.success) expect(r2.data.idNumber).toBe("12345678");
  });

  it("el correo SIGUE siendo opcional", () => {
    const conCedula = { ...BASE, idNumber: "1012345678" };
    expect(createOrderSchema.safeParse(conCedula).success).toBe(true);
    expect(
      createOrderSchema.safeParse({ ...conCedula, email: "" }).success
    ).toBe(true);
    expect(
      createOrderSchema.safeParse({ ...conCedula, email: "a@b.com" }).success
    ).toBe(true);
  });

  it("una cédula con letras se rechaza", () => {
    const r = createOrderSchema.safeParse({ ...BASE, idNumber: "1234A567" });
    expect(r.success).toBe(false);
  });
});

describe("los mensajes de error los lee un comprador", () => {
  it("sin cédula el mensaje sale en español, no el de Zod", () => {
    const r = createOrderSchema.safeParse(BASE);
    expect(r.success).toBe(false);
    if (!r.success) {
      const msg = r.error.issues[0]?.message ?? "";
      expect(msg).toContain("cédula");
      expect(msg).not.toContain("expected");
      expect(msg).not.toContain("undefined");
    }
  });

  it("sin nombre y sin teléfono también salen en español", () => {
    for (const campo of ["name", "phone"] as const) {
      const cuerpo: Record<string, unknown> = {
        ...BASE,
        idNumber: "1012345678",
      };
      delete cuerpo[campo];
      const r = createOrderSchema.safeParse(cuerpo);
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0]?.message ?? "").not.toContain("expected");
      }
    }
  });
});
