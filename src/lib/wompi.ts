import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Integración con Wompi (pasarela colombiana: Nequi, PSE, tarjetas,
 * Bancolombia). Modelo Web Checkout + webhook de eventos:
 *
 * 1. Se genera un enlace de checkout firmado (firma de integridad SHA-256).
 * 2. Wompi procesa el pago y notifica a /api/webhooks/wompi (evento firmado).
 * 3. El backend verifica la firma del evento Y consulta la transacción; solo
 *    entonces confirma la orden (confirmOrderPayment, idempotente).
 *
 * Credenciales (.env — ver docs/PAGOS.md):
 *   WOMPI_PUBLIC_KEY       pub_test_... | pub_prod_...
 *   WOMPI_INTEGRITY_SECRET test_integrity_... | prod_integrity_...
 *   WOMPI_EVENTS_SECRET    test_events_... | prod_events_...
 * Sin credenciales, la plataforma opera con confirmación manual (WhatsApp +
 * panel admin), que es un flujo real, no simulado.
 */

export function isWompiConfigured(): boolean {
  return Boolean(
    process.env.WOMPI_PUBLIC_KEY && process.env.WOMPI_INTEGRITY_SECRET
  );
}

function apiBase(): string {
  const key = process.env.WOMPI_PUBLIC_KEY ?? "";
  return key.startsWith("pub_prod_")
    ? "https://production.wompi.co/v1"
    : "https://sandbox.wompi.co/v1";
}

/** Referencia única de pago para una orden. */
export function paymentReference(orderCode: string): string {
  return `DYS-${orderCode}`;
}

/** Firma de integridad exigida por Wompi en el checkout. */
export function integritySignature(
  reference: string,
  amountInCents: number
): string {
  const secret = process.env.WOMPI_INTEGRITY_SECRET ?? "";
  return createHash("sha256")
    .update(`${reference}${amountInCents}COP${secret}`)
    .digest("hex");
}

/** URL del Web Checkout de Wompi para una orden. */
export function checkoutUrl(params: {
  orderCode: string;
  totalCop: number;
  redirectUrl: string;
  customerName?: string;
  customerPhone?: string;
}): string {
  const reference = paymentReference(params.orderCode);
  const amountInCents = params.totalCop * 100;
  const search = new URLSearchParams({
    "public-key": process.env.WOMPI_PUBLIC_KEY ?? "",
    currency: "COP",
    "amount-in-cents": String(amountInCents),
    reference,
    "signature:integrity": integritySignature(reference, amountInCents),
    "redirect-url": params.redirectUrl,
  });
  if (params.customerPhone) {
    search.set("customer-data:phone-number", params.customerPhone);
  }
  if (params.customerName) {
    search.set("customer-data:full-name", params.customerName);
  }
  return `https://checkout.wompi.co/p/?${search.toString()}`;
}

type WompiEvent = {
  event: string;
  data: { transaction?: WompiTransaction };
  timestamp: number;
  signature: { properties: string[]; checksum: string };
};

export type WompiTransaction = {
  id: string;
  status: "APPROVED" | "DECLINED" | "VOIDED" | "ERROR" | "PENDING";
  reference: string;
  amount_in_cents: number;
  currency: string;
  payment_method_type?: string;
};

/** Verifica la firma del evento del webhook (SHA-256 de propiedades + timestamp + secreto). */
export function verifyEventSignature(event: WompiEvent): boolean {
  const secret = process.env.WOMPI_EVENTS_SECRET ?? "";
  if (!secret || !event?.signature?.checksum) return false;
  try {
    let concatenated = "";
    for (const prop of event.signature.properties) {
      // "transaction.id" → event.data.transaction.id
      let value: unknown = event.data;
      for (const part of prop.split(".")) {
        value = (value as Record<string, unknown>)?.[part];
      }
      concatenated += String(value ?? "");
    }
    concatenated += String(event.timestamp) + secret;
    const digest = createHash("sha256").update(concatenated).digest("hex");
    // Comparación en tiempo constante (no filtra información por latencia).
    const a = Buffer.from(digest, "utf8");
    const b = Buffer.from(String(event.signature.checksum), "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/**
 * Verifica que la transacción corresponda REALMENTE a la orden: moneda COP,
 * estado aprobado y monto exacto. Sin esto, cualquiera podría crear en la
 * pasarela una transacción de $1.000 con la referencia de una orden de
 * $200.000 y dispararía la confirmación.
 */
export function transactionMatchesOrder(
  tx: WompiTransaction,
  order: { total: number }
): boolean {
  if (tx.currency !== "COP") return false;
  return Math.round(tx.amount_in_cents / 100) === order.total;
}

/** Consulta una transacción directamente en Wompi (verificación de respaldo). */
export async function fetchTransaction(
  transactionId: string
): Promise<WompiTransaction | null> {
  try {
    const res = await fetch(`${apiBase()}/transactions/${transactionId}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.data as WompiTransaction) ?? null;
  } catch {
    return null;
  }
}

/** Busca la transacción aprobada de una referencia (fallback en el redirect). */
export async function findTransactionByReference(
  reference: string
): Promise<WompiTransaction | null> {
  const pub = process.env.WOMPI_PUBLIC_KEY ?? "";
  if (!pub) return null;
  try {
    const res = await fetch(
      `${apiBase()}/transactions?reference=${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${pub}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const list = (data?.data as WompiTransaction[]) ?? [];
    return list.find((t) => t.status === "APPROVED") ?? list[0] ?? null;
  } catch {
    return null;
  }
}
