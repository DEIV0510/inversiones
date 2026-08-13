import { beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";

beforeEach(() => {
  process.env.WOMPI_PUBLIC_KEY = "pub_test_abc";
  process.env.WOMPI_INTEGRITY_SECRET = "test_integrity_secreto";
  process.env.WOMPI_EVENTS_SECRET = "test_events_secreto";
});

describe("integridad del checkout", () => {
  it("firma referencia+monto+moneda+secreto en SHA-256", async () => {
    const { integritySignature, paymentReference } = await import("@/lib/wompi");
    const ref = paymentReference("ABC12345");
    expect(ref).toBe("DYS-ABC12345");
    const expected = createHash("sha256")
      .update(`${ref}2000000COP${process.env.WOMPI_INTEGRITY_SECRET}`)
      .digest("hex");
    expect(integritySignature(ref, 2000000)).toBe(expected);
  });

  it("checkoutUrl incluye llave, monto en centavos y firma", async () => {
    const { checkoutUrl } = await import("@/lib/wompi");
    const url = new URL(
      checkoutUrl({
        orderCode: "ABC12345",
        totalCop: 20000,
        redirectUrl: "https://ejemplo.com/pedido/ABC12345",
      })
    );
    expect(url.hostname).toBe("checkout.wompi.co");
    expect(url.searchParams.get("amount-in-cents")).toBe("2000000");
    expect(url.searchParams.get("reference")).toBe("DYS-ABC12345");
    expect(url.searchParams.get("signature:integrity")).toHaveLength(64);
  });
});

describe("verificación de eventos del webhook", () => {
  function buildEvent(secret: string) {
    const tx = { id: "tx-1", status: "APPROVED", amount_in_cents: 2000000 };
    const timestamp = 1700000000;
    const checksum = createHash("sha256")
      .update(`${tx.id}${tx.status}${tx.amount_in_cents}${timestamp}${secret}`)
      .digest("hex");
    return {
      event: "transaction.updated",
      data: { transaction: tx },
      timestamp,
      signature: {
        properties: ["transaction.id", "transaction.status", "transaction.amount_in_cents"],
        checksum,
      },
    };
  }

  it("acepta firma válida", async () => {
    const { verifyEventSignature } = await import("@/lib/wompi");
    const event = buildEvent(process.env.WOMPI_EVENTS_SECRET!);
    expect(verifyEventSignature(event as never)).toBe(true);
  });

  it("rechaza firma inválida", async () => {
    const { verifyEventSignature } = await import("@/lib/wompi");
    const event = buildEvent("otro_secreto");
    expect(verifyEventSignature(event as never)).toBe(false);
  });
});
