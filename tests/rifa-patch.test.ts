import { describe, expect, it } from "vitest";
import { rafflePatchSchema, raffleSchema } from "@/lib/validation";
import { rifaTieneFormaDeCobro } from "@/lib/pasarela";

/**
 * Un PATCH de rifa tiene que tocar SOLO lo que le mandan.
 *
 * El fallo que estas pruebas vigilan: el esquema del PATCH se armaba con
 * `.partial()`, que hace opcional cada campo pero NO le quita su
 * `.default(...)` — y un `.default()` salta justo cuando el campo no viene.
 * Un PATCH de `{status:"ACTIVE"}` salía del validador con los dos
 * interruptores de cobro encendidos, la galería vacía y los paquetes de
 * fábrica, y todo eso se escribía encima de lo que el dueño tenía guardado.
 *
 * Lo caro no era el borrado: era que, al reencender los dos interruptores por
 * su cuenta, el 422 que impide publicar una rifa sin forma de cobrar no
 * llegaba a saltar nunca por esa puerta.
 */

describe("PATCH de rifa: solo lo que viene", () => {
  it("un PATCH de solo estado NO trae ningún otro campo", () => {
    const r = rafflePatchSchema.safeParse({ status: "ACTIVE" });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({ status: "ACTIVE" });
  });

  it("no reenciende los interruptores de cobro que el dueño apagó", () => {
    const r = rafflePatchSchema.safeParse({ status: "ACTIVE" });
    expect(r.data!.whatsappCheckout).toBeUndefined();
    expect(r.data!.gatewayCheckout).toBeUndefined();

    // Así es como el route handler compone el estado FINAL: lo enviado si
    // viene, lo guardado si no. Con el fallo, aquí salían dos `true`.
    const guardado = { whatsappCheckout: false, gatewayCheckout: false };
    const final = {
      whatsappCheckout: r.data!.whatsappCheckout ?? guardado.whatsappCheckout,
      gatewayCheckout: r.data!.gatewayCheckout ?? guardado.gatewayCheckout,
    };
    expect(final).toEqual({ whatsappCheckout: false, gatewayCheckout: false });
    // Y por lo tanto el 422 SÍ tiene que saltar.
    expect(rifaTieneFormaDeCobro(final)).toBe(false);
  });

  it("no borra galería, paquetes, premios ni apartados premiados", () => {
    const r = rafflePatchSchema.safeParse({ displayOrder: 3 });
    expect(r.success).toBe(true);
    for (const campo of [
      "gallery",
      "ticketPacks",
      "prizes",
      "prizedNumbers",
      "description",
      "terms",
      "drawDateText",
      "imageUrl",
      "imageAspect",
      "selectionMode",
      "showPrize",
      "showDrawDate",
      "progressMode",
      "manualProgressPct",
      "reservationMinutes",
      "minNumbersPerOrder",
      "maxNumbersPerOrder",
    ] as const) {
      expect(r.data![campo], `${campo} no debería venir en el PATCH`).toBeUndefined();
    }
  });

  it("lo que SÍ se manda llega tal cual, incluido un false", () => {
    const r = rafflePatchSchema.safeParse({
      whatsappCheckout: false,
      gatewayCheckout: true,
      gallery: ["/uploads/a.jpg"],
    });
    expect(r.success).toBe(true);
    expect(r.data).toEqual({
      whatsappCheckout: false,
      gatewayCheckout: true,
      gallery: ["/uploads/a.jpg"],
    });
  });

  it("sigue validando igual de duro lo que sí viene", () => {
    expect(rafflePatchSchema.safeParse({ whatsappCheckout: "sí" }).success).toBe(false);
    expect(rafflePatchSchema.safeParse({ slug: "MAYÚSCULAS NO" }).success).toBe(false);
    expect(rafflePatchSchema.safeParse({ pricePerNumber: 50 }).success).toBe(false);
    expect(rafflePatchSchema.safeParse({ status: "INVENTADO" }).success).toBe(false);
    // Los dos límites juntos se siguen comparando entre ellos.
    const cruzado = rafflePatchSchema.safeParse({
      minNumbersPerOrder: 30,
      maxNumbersPerOrder: 10,
    });
    expect(cruzado.success).toBe(false);
    expect(cruzado.error!.issues[0]!.message).toContain("compra mínima");
  });

  it("el POST (crear) SÍ conserva sus valores de fábrica", () => {
    // Al crear no hay nada guardado con lo que rellenar: los defaults son los
    // que hacen que una rifa nueva nazca vendible. Eso no se toca.
    const r = raffleSchema.safeParse({
      title: "Rifa nueva",
      slug: "rifa-nueva",
      prize: "Una moto",
      pricePerNumber: 5000,
      totalNumbers: 1000,
      status: "DRAFT",
    });
    expect(r.success).toBe(true);
    expect(r.data!.whatsappCheckout).toBe(true);
    expect(r.data!.gatewayCheckout).toBe(true);
    expect(r.data!.ticketPacks.length).toBeGreaterThan(0);
  });
});
