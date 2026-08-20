import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash, createHmac } from "node:crypto";

/**
 * Pruebas del lado servidor de Bold: firma de integridad del botón, firma del
 * webhook y la comprobación de que el pago corresponde a la orden. Es la
 * parte donde un error cuesta dinero de verdad.
 */

const SECRETO = "kgfq2nN0o52XqnuXZWIN2F"; // el del ejemplo oficial de Bold

beforeEach(() => {
  process.env.BOLD_IDENTITY_KEY = "identidad_de_prueba";
  process.env.BOLD_SECRET_KEY = SECRETO;
  delete process.env.BOLD_ENV;
});

afterEach(() => {
  // NODE_ENV es de solo lectura para TypeScript: se toca con stubEnv.
  vi.unstubAllEnvs();
});

describe("configuración", () => {
  it("hace falta identidad Y secreto", async () => {
    const { isBoldConfigured, boldIdentityKey } = await import("@/lib/bold");
    expect(isBoldConfigured()).toBe(true);
    expect(boldIdentityKey()).toBe("identidad_de_prueba");
    delete process.env.BOLD_SECRET_KEY;
    expect(isBoldConfigured()).toBe(false);
  });
});

describe("firma de integridad del botón", () => {
  it("reproduce el ejemplo oficial de Bold: {OrderId}{Amount}{Currency}{SecretKey}", async () => {
    const { boldIntegritySignature } = await import("@/lib/bold");
    // Cadena del propio Bold: "inv03343" + "9400" + "COP" + secreto.
    const cadenaOficial = "inv033439400COPkgfq2nN0o52XqnuXZWIN2F";
    const esperada = createHash("sha256").update(cadenaOficial).digest("hex");
    expect(
      boldIntegritySignature({ orderId: "inv03343", amount: 9400, currency: "COP" })
    ).toBe(esperada);
  });

  it("cambiar el monto cambia la firma (nadie puede editar data-amount)", async () => {
    const { boldIntegritySignature } = await import("@/lib/bold");
    const buena = boldIntegritySignature({ orderId: "DYS-ABC12345", amount: 20000 });
    const trucada = boldIntegritySignature({ orderId: "DYS-ABC12345", amount: 1000 });
    expect(buena).toHaveLength(64);
    expect(buena).not.toBe(trucada);
  });

  it("la configuración del botón cobra el total de la ORDEN, no lo que digan", async () => {
    const { boldButtonConfig, boldIntegritySignature } = await import("@/lib/bold");
    const config = boldButtonConfig({
      orderCode: "ABC12345",
      totalCop: 20000,
      redirectUrl: "https://inversionesdys.co/pedido/ABC12345",
      description: "Pedido ABC12345 — 4 boletas",
      customerName: "Ana",
      customerEmail: "ana@correo.com",
    });
    expect(config.amount).toBe(20000);
    expect(config.currency).toBe("COP");
    expect(config.orderId).toBe("DYS-ABC12345");
    expect(config.apiKey).toBe("identidad_de_prueba");
    expect(config.integritySignature).toBe(
      boldIntegritySignature({ orderId: "DYS-ABC12345", amount: 20000 })
    );
    // La llave secreta NO puede aparecer en nada de lo que baja al navegador.
    expect(JSON.stringify(config)).not.toContain(SECRETO);
    expect(JSON.parse(config.customerData!)).toMatchObject({
      email: "ana@correo.com",
      fullName: "Ana",
    });
  });

  it("la descripción se recorta a los 100 caracteres que admite Bold", async () => {
    const { boldButtonConfig } = await import("@/lib/bold");
    const config = boldButtonConfig({
      orderCode: "ABC12345",
      totalCop: 20000,
      redirectUrl: "https://inversionesdys.co/pedido/ABC12345",
      description: "x".repeat(250),
    });
    expect(config.description).toHaveLength(100);
  });
});

describe("referencia del pedido", () => {
  it("va y vuelve, con y sin sufijo de reintento", async () => {
    const { boldOrderId, orderCodeFromBoldReference } = await import("@/lib/bold");
    expect(boldOrderId("ABC12345")).toBe("DYS-ABC12345");
    expect(orderCodeFromBoldReference("DYS-ABC12345")).toBe("ABC12345");
    expect(orderCodeFromBoldReference(boldOrderId("ABC12345", 2))).toBe("ABC12345");
  });

  it("acepta también el código pelado, por si acaso", async () => {
    const { orderCodeFromBoldReference } = await import("@/lib/bold");
    expect(orderCodeFromBoldReference("ABC12345")).toBe("ABC12345");
  });

  it("ignora referencias ajenas (cobros del datáfono)", async () => {
    const { orderCodeFromBoldReference } = await import("@/lib/bold");
    expect(orderCodeFromBoldReference("ORD-20251021-00145")).toBeNull();
    expect(orderCodeFromBoldReference("")).toBeNull();
  });
});

describe("topes de Bold", () => {
  it("acepta de $1.000 a $10.000.000 y nada fuera", async () => {
    const { boldAmountSupported } = await import("@/lib/bold");
    expect(boldAmountSupported(1000)).toBe(true);
    expect(boldAmountSupported(999)).toBe(false);
    expect(boldAmountSupported(10_000_000)).toBe(true);
    expect(boldAmountSupported(10_000_001)).toBe(false);
  });
});

// ── Webhook ──────────────────────────────────────────────────────────

function cuerpoDeVenta(total: number, currency = "COP") {
  return JSON.stringify({
    id: "evt-1",
    type: "SALE_APPROVED",
    subject: "F8A5D6B7G2H1",
    source: "/payments",
    spec_version: "1.0",
    time: 1761060600000000000,
    data: {
      payment_id: "F8A5D6B7G2H1",
      merchant_id: "PQR6Y4T8Z3",
      created_at: "2025-10-21T11:30:15-05:00",
      amount: { currency, total, taxes: [], tip: 0 },
      metadata: { reference: "DYS-ABC12345" },
      bold_code: "B000",
      payer_email: "cliente@email.com",
      payment_method: "CARD",
    },
    datacontenttype: "application/json",
  });
}

/** Firma tal como la calcula Bold: HMAC-SHA256(base64(cuerpo), secreto) en hex. */
function firmarComoBold(cuerpo: string, secreto: string): string {
  return createHmac("sha256", secreto)
    .update(Buffer.from(cuerpo, "utf8").toString("base64"))
    .digest("hex");
}

describe("firma del webhook", () => {
  it("acepta una firma válida", async () => {
    const { verifyBoldWebhook } = await import("@/lib/bold");
    const cuerpo = cuerpoDeVenta(20000);
    expect(verifyBoldWebhook(cuerpo, firmarComoBold(cuerpo, SECRETO))).toBe(true);
  });

  it("rechaza una firma calculada con otro secreto", async () => {
    const { verifyBoldWebhook } = await import("@/lib/bold");
    const cuerpo = cuerpoDeVenta(20000);
    expect(verifyBoldWebhook(cuerpo, firmarComoBold(cuerpo, "otro_secreto"))).toBe(
      false
    );
  });

  it("rechaza una firma de largo distinto sin reventar", async () => {
    const { verifyBoldWebhook } = await import("@/lib/bold");
    const cuerpo = cuerpoDeVenta(20000);
    expect(verifyBoldWebhook(cuerpo, "abc123")).toBe(false);
    expect(verifyBoldWebhook(cuerpo, firmarComoBold(cuerpo, SECRETO) + "00")).toBe(
      false
    );
    expect(verifyBoldWebhook(cuerpo, null)).toBe(false);
    expect(verifyBoldWebhook(cuerpo, "")).toBe(false);
  });

  it("rechaza si el cuerpo fue alterado después de firmar", async () => {
    const { verifyBoldWebhook } = await import("@/lib/bold");
    const original = cuerpoDeVenta(1000);
    const firma = firmarComoBold(original, SECRETO);
    expect(verifyBoldWebhook(cuerpoDeVenta(20000), firma)).toBe(false);
  });

  it("la firma de PRUEBAS (secreto vacío) solo vale con BOLD_ENV=test fuera de producción", async () => {
    const { verifyBoldWebhook } = await import("@/lib/bold");
    const cuerpo = cuerpoDeVenta(20000);
    const firmaVacia = firmarComoBold(cuerpo, "");

    // Por omisión no se admite.
    expect(verifyBoldWebhook(cuerpo, firmaVacia)).toBe(false);

    // En sandbox local sí.
    process.env.BOLD_ENV = "test";
    vi.stubEnv("NODE_ENV", "development");
    expect(verifyBoldWebhook(cuerpo, firmaVacia)).toBe(true);
    // Y la firma real sigue valiendo.
    expect(verifyBoldWebhook(cuerpo, firmarComoBold(cuerpo, SECRETO))).toBe(true);

    // En producción JAMÁS, aunque quedara BOLD_ENV=test por descuido.
    vi.stubEnv("NODE_ENV", "production");
    expect(verifyBoldWebhook(cuerpo, firmaVacia)).toBe(false);
  });
});

describe("el pago debe corresponder a la orden", () => {
  async function evento(total: number, currency = "COP") {
    return JSON.parse(cuerpoDeVenta(total, currency));
  }

  it("acepta el monto exacto en COP", async () => {
    const { boldTransactionMatchesOrder } = await import("@/lib/bold");
    expect(boldTransactionMatchesOrder(await evento(20000), { total: 20000 })).toBe(
      true
    );
  });

  it("rechaza un pago de $1.000 por una orden de $20.000", async () => {
    const { boldTransactionMatchesOrder } = await import("@/lib/bold");
    expect(boldTransactionMatchesOrder(await evento(1000), { total: 20000 })).toBe(
      false
    );
  });

  it("rechaza un pago de más (propina o recargo inesperado)", async () => {
    const { boldTransactionMatchesOrder } = await import("@/lib/bold");
    expect(boldTransactionMatchesOrder(await evento(21000), { total: 20000 })).toBe(
      false
    );
  });

  it("rechaza otra moneda", async () => {
    const { boldTransactionMatchesOrder } = await import("@/lib/bold");
    expect(
      boldTransactionMatchesOrder(await evento(20000, "USD"), { total: 20000 })
    ).toBe(false);
  });

  it("rechaza un evento sin monto", async () => {
    const { boldTransactionMatchesOrder } = await import("@/lib/bold");
    expect(
      boldTransactionMatchesOrder({ type: "SALE_APPROVED", data: {} }, { total: 20000 })
    ).toBe(false);
  });
});

describe("capa común de pasarelas", () => {
  beforeEach(() => {
    delete process.env.WOMPI_PUBLIC_KEY;
    delete process.env.WOMPI_INTEGRITY_SECRET;
  });

  it("sin llaves no hay pasarela", async () => {
    const { hayPasarelaConfigurada, pasarelaActiva } = await import("@/lib/pasarela");
    delete process.env.BOLD_SECRET_KEY;
    expect(pasarelaActiva()).toBeNull();
    expect(hayPasarelaConfigurada()).toBe(false);
  });

  it("con las dos configuradas gana Bold", async () => {
    const { pasarelaActiva, pasarelasConfiguradas } = await import("@/lib/pasarela");
    process.env.WOMPI_PUBLIC_KEY = "pub_test_abc";
    process.env.WOMPI_INTEGRITY_SECRET = "test_integrity_abc";
    expect(pasarelaActiva()).toBe("bold");
    expect(pasarelasConfiguradas()).toEqual(["bold", "wompi"]);
  });

  it("la rifa con la pasarela apagada no ofrece pasarela aunque haya llaves", async () => {
    const { pasarelaDeRifa } = await import("@/lib/pasarela");
    expect(pasarelaDeRifa({ gatewayCheckout: true })).toBe("bold");
    expect(pasarelaDeRifa({ gatewayCheckout: false })).toBeNull();
  });

  it("una rifa sin WhatsApp y sin pasarela encendida se queda sin forma de cobrar", async () => {
    const { rifaTieneFormaDeCobro } = await import("@/lib/pasarela");
    expect(
      rifaTieneFormaDeCobro({ whatsappCheckout: false, gatewayCheckout: true })
    ).toBe(true);
    expect(
      rifaTieneFormaDeCobro({ whatsappCheckout: true, gatewayCheckout: false })
    ).toBe(true);
    expect(
      rifaTieneFormaDeCobro({ whatsappCheckout: false, gatewayCheckout: false })
    ).toBe(false);
  });
});
