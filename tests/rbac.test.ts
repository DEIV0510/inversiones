import { describe, expect, it } from "vitest";
import { can } from "@/lib/rbac";

describe("matriz de permisos", () => {
  it("SUPER_ADMIN puede todo", () => {
    expect(can("SUPER_ADMIN", "users.manage")).toBe(true);
    expect(can("SUPER_ADMIN", "raffles.manage")).toBe(true);
    expect(can("SUPER_ADMIN", "orders.confirm")).toBe(true);
  });

  it("ADMIN no gestiona usuarios", () => {
    expect(can("ADMIN", "users.manage")).toBe(false);
    expect(can("ADMIN", "raffles.manage")).toBe(true);
    expect(can("ADMIN", "audit.view")).toBe(true);
  });

  it("SOPORTE puede ver y bloquear números pero no confirmar pagos", () => {
    expect(can("SOPORTE", "numbers.block")).toBe(true);
    expect(can("SOPORTE", "orders.confirm")).toBe(false);
    expect(can("SOPORTE", "payments.view")).toBe(false);
    expect(can("SOPORTE", "raffles.manage")).toBe(false);
  });

  it("FINANZAS confirma pagos pero no gestiona rifas", () => {
    expect(can("FINANZAS", "orders.confirm")).toBe(true);
    expect(can("FINANZAS", "payments.view")).toBe(true);
    expect(can("FINANZAS", "raffles.manage")).toBe(false);
    expect(can("FINANZAS", "numbers.block")).toBe(false);
  });
});
