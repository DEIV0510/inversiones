import { describe, expect, it } from "vitest";
import { createOrderSchema } from "@/lib/validation";

/**
 * PAGO QUE LLEGA TARDE — el fallo que costó dinero de verdad.
 *
 * El pedido 9Y45RPNH: creado 21:31:23, reserva vencida 21:37:23, pago de Bold
 * a las 21:38:32. El motor rechazaba todo lo que no estuviera PENDING, así que
 * el cobro entró y el comprador se quedó sin números.
 *
 * Estas pruebas vigilan la REGLA, no la implementación: si alguien vuelve a
 * dejar EXPIRED fuera, fallan.
 */
describe("un pedido vencido debe poder confirmarse", () => {
  it("EXPIRED está entre los estados confirmables del motor", async () => {
    const fuente = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/engine/orders.ts", "utf8")
    );
    // La guarda que cortaba el rescate.
    expect(fuente).toContain('order.status !== "PENDING" && order.status !== "EXPIRED"');
    // Y no queda ninguna guarda que corte solo por PENDING.
    expect(fuente).not.toMatch(/if \(order\.status !== "PENDING"\) \{/);
  });

  it("el barrido da gracia a los pedidos con intento de pago", async () => {
    const fuente = await import("node:fs").then((fs) =>
      fs.readFileSync("src/lib/engine/orders.ts", "utf8")
    );
    expect(fuente).toContain("GRACIA_CON_INTENTO_MS");
    expect(fuente).toContain("payments: { none: {} }");
  });

  it("la página del pedido pregunta a Bold ANTES de vencer", async () => {
    const fuente = await import("node:fs").then((fs) =>
      fs.readFileSync("src/app/pedido/[code]/page.tsx", "utf8")
    );
    const posConsulta = fuente.indexOf("fetchBoldTransaction");
    const posVence = fuente.indexOf("isOrderExpired(order)");
    expect(posConsulta).toBeGreaterThan(-1);
    expect(posVence).toBeGreaterThan(-1);
    expect(posConsulta).toBeLessThan(posVence);
  });

  it("borrar una rifa mira el DINERO, no solo el estado del pedido", async () => {
    const fuente = await import("node:fs").then((fs) =>
      fs.readFileSync("src/app/api/admin/raffles/[id]/route.ts", "utf8")
    );
    expect(fuente).toContain("payments: { some: { status: { in:");
  });
});

describe("un campo opcional nunca puede bloquear la compra", () => {
  const BASE = {
    raffleSlug: "sorteo",
    name: "Juan Perez",
    phone: "3106930187",
    idNumber: "1012345678",
    randomCount: 1,
  };

  it("un espacio suelto en ciudad NO tumba el pedido", () => {
    const r = createOrderSchema.safeParse({ ...BASE, city: " " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.city).toBeUndefined();
  });

  it("una ciudad de una sola letra tampoco lo tumba", () => {
    const r = createOrderSchema.safeParse({ ...BASE, city: "a" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.city).toBeUndefined();
  });

  it("una ciudad de verdad sí se guarda, sin espacios sobrantes", () => {
    const r = createOrderSchema.safeParse({ ...BASE, city: "  Sincelejo  " });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.city).toBe("Sincelejo");
  });
});
