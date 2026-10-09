import { describe, expect, it, vi } from "vitest";

// El motor importa la base de datos; estas pruebas solo usan su parte pura
// (datosDelComprador), así que la base se simula vacía.
vi.mock("@/lib/db", () => ({ prisma: {} }));

const { createOrderSchema } = await import("@/lib/validation");
const { datosDelComprador, OrderError } = await import("@/lib/engine/orders");

/**
 * Qué datos se le exigen al comprador.
 *
 * En la rifa GRANDE la cédula es OBLIGATORIA: el dueño quiere identificar al
 * ganador con nombre + cédula + celular, y al comprador le sirve para
 * encontrar sus boletas. El correo sigue opcional.
 *
 * Desde las rifas de CUADRÍCULA eso se configura por rifa (askPhone,
 * askIdNumber…), y por eso la regla ya no puede vivir en el esquema del API
 * —que corre antes de saber de qué rifa es el pedido— sino en el motor.
 * Estas pruebas van contra el MOTOR a propósito: es lo que manda aunque
 * alguien llame al API sin pasar por la pantalla.
 */

/** La rifa grande tal como queda con los valores por defecto de la base. */
const RIFA_GRANDE = {
  askPhone: true,
  askIdNumber: true,
  askEmail: true,
  askCity: true,
  whatsappCheckout: false,
};

/** Rifa de cuadrícula: solo el nombre. */
const RIFA_SOLO_NOMBRE = {
  askPhone: false,
  askIdNumber: false,
  askEmail: false,
  askCity: false,
  whatsappCheckout: true,
};

const BASE = {
  raffleSlug: "sorteo",
  name: "Juan Perez",
  phone: "3106930187",
  randomCount: 1,
};

function mensajeDe(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(OrderError);
    return (err as Error).message;
  }
  throw new Error("se esperaba un rechazo");
}

describe("cédula obligatoria en la rifa grande", () => {
  it("un pedido sin cédula se rechaza", () => {
    const msg = mensajeDe(() => datosDelComprador(RIFA_GRANDE, BASE));
    expect(msg).toContain("cédula");
  });

  it("una cédula vacía se rechaza", () => {
    expect(() =>
      datosDelComprador(RIFA_GRANDE, { ...BASE, idNumber: "" })
    ).toThrow(OrderError);
  });

  it("una cédula demasiado corta se rechaza (esquema y motor)", () => {
    expect(
      createOrderSchema.safeParse({ ...BASE, idNumber: "123" }).success
    ).toBe(false);
    expect(() =>
      datosDelComprador(RIFA_GRANDE, { ...BASE, idNumber: "123" })
    ).toThrow(OrderError);
  });

  it("acepta la cédula con puntos y espacios, y guarda solo dígitos", () => {
    const r = createOrderSchema.safeParse({ ...BASE, idNumber: "12.345.678" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.idNumber).toBe("12345678");

    const r2 = createOrderSchema.safeParse({ ...BASE, idNumber: "12 345 678" });
    expect(r2.success).toBe(true);
    if (r2.success) expect(r2.data.idNumber).toBe("12345678");

    expect(
      datosDelComprador(RIFA_GRANDE, { ...BASE, idNumber: "12.345.678" }).cedula
    ).toBe("12345678");
  });

  it("el correo SIGUE siendo opcional", () => {
    const conCedula = { ...BASE, idNumber: "1012345678" };
    expect(datosDelComprador(RIFA_GRANDE, conCedula).email).toBeUndefined();
    expect(
      datosDelComprador(RIFA_GRANDE, { ...conCedula, email: "" }).email
    ).toBeUndefined();
    expect(
      datosDelComprador(RIFA_GRANDE, { ...conCedula, email: "a@b.com" }).email
    ).toBe("a@b.com");
    expect(
      createOrderSchema.safeParse({ ...conCedula, email: "" }).success
    ).toBe(true);
  });

  it("una cédula con letras se rechaza en el esquema", () => {
    const r = createOrderSchema.safeParse({ ...BASE, idNumber: "1234A567" });
    expect(r.success).toBe(false);
  });

  it("sin celular se rechaza, y el celular queda normalizado", () => {
    const sinCelular = { ...BASE, idNumber: "1012345678", phone: undefined };
    expect(mensajeDe(() => datosDelComprador(RIFA_GRANDE, sinCelular))).toMatch(
      /teléfono|WhatsApp/
    );
    expect(
      datosDelComprador(RIFA_GRANDE, { ...BASE, idNumber: "1012345678" }).phone
    ).toBe("573106930187");
  });

  it("una rifa SIN la configuración se trata como la estricta", () => {
    // Fila vieja u objeto incompleto: nunca se cae del lado de aceptar un
    // pedido sin identificar.
    expect(() =>
      datosDelComprador({ whatsappCheckout: false } as never, BASE)
    ).toThrow(OrderError);
  });
});

describe("rifa de cuadrícula: solo el nombre", () => {
  it("reserva sin celular, sin cédula y sin correo", () => {
    const datos = datosDelComprador(RIFA_SOLO_NOMBRE, {});
    expect(datos.phone).toBeNull();
    expect(datos.cedula).toBeUndefined();
    expect(datos.email).toBeUndefined();
    expect(datos.city).toBeUndefined();
  });

  it("descarta los datos que la rifa NO pide aunque vengan en la petición", () => {
    // Un celular colado en una rifa que no lo pide fundiría a esta persona con
    // el participante de ese número (el upsert le cambiaría el nombre).
    const datos = datosDelComprador(RIFA_SOLO_NOMBRE, {
      phone: "3106930187",
      idNumber: "1012345678",
      email: "a@b.com",
      city: "Sincelejo",
    });
    expect(datos).toEqual({
      phone: null,
      cedula: undefined,
      email: undefined,
      city: undefined,
    });
  });

  it("si la rifa pide celular, lo exige aunque no pida cédula", () => {
    const rifa = { ...RIFA_SOLO_NOMBRE, askPhone: true };
    expect(() => datosDelComprador(rifa, {})).toThrow(OrderError);
    expect(datosDelComprador(rifa, { phone: "310 693 0187" }).phone).toBe(
      "573106930187"
    );
  });

  it("el esquema deja pasar un pedido que solo trae el nombre", () => {
    const r = createOrderSchema.safeParse({
      raffleSlug: "sorteo",
      name: "Juan Perez",
      numbers: [7, 23],
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.phone).toBeUndefined();
      expect(r.data.idNumber).toBeUndefined();
    }
  });

  it("un celular vacío o en blanco llega como 'no hay dato'", () => {
    const r = createOrderSchema.safeParse({ ...BASE, phone: "   " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.phone).toBeUndefined();
  });
});

describe("los mensajes de error los lee un comprador", () => {
  it("sin cédula el mensaje sale en español", () => {
    const msg = mensajeDe(() => datosDelComprador(RIFA_GRANDE, BASE));
    expect(msg).toContain("cédula");
    expect(msg).not.toContain("expected");
    expect(msg).not.toContain("undefined");
  });

  it("sin nombre el esquema responde en español", () => {
    const cuerpo: Record<string, unknown> = { ...BASE, idNumber: "1012345678" };
    delete cuerpo.name;
    const r = createOrderSchema.safeParse(cuerpo);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message ?? "").not.toContain("expected");
    }
  });

  it("una cédula mal escrita responde en español", () => {
    const r = createOrderSchema.safeParse({ ...BASE, idNumber: "12" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0]?.message ?? "").toContain("cédula");
    }
  });
});
