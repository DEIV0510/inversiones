import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Integración con Bold (pasarela colombiana: tarjetas, PSE, Nequi, botón
 * Bancolombia). Modelo "Botón de Pagos" con integración manual + webhook:
 *
 * 1. El servidor arma los atributos del botón y FIRMA la operación
 *    (firma de integridad SHA-256 con la llave secreta, que nunca sale de
 *    aquí). El navegador solo recibe la llave de IDENTIDAD.
 * 2. Bold cobra y notifica a /api/webhooks/bold (evento firmado con
 *    HMAC-SHA256 sobre el cuerpo).
 * 3. El backend verifica la firma, comprueba que el monto sea EXACTAMENTE el
 *    de la orden guardada y solo entonces confirma (confirmOrderPayment,
 *    idempotente).
 *
 * Por qué el botón y no el enlace de pago: los enlaces de checkout.bold.co
 * (LNK_...) son de MONTO FIJO y no identifican el pedido. En una rifa cada
 * pedido vale distinto y hay que saber cuál se pagó, así que hace falta el
 * botón con monto y referencia por pedido.
 *
 * Credenciales (.env — ver docs/PAGOS.md):
 *   BOLD_IDENTITY_KEY  llave de identidad (pública, puede ir al navegador)
 *   BOLD_SECRET_KEY    llave secreta (JAMÁS al navegador: firma y webhook)
 *   BOLD_ENV           "test" solo para el sandbox local (ver más abajo)
 * Sin credenciales, Bold simplemente no se ofrece; la plataforma sigue
 * cobrando por WhatsApp + confirmación manual en el panel.
 */

/** Mínimo que acepta Bold por transacción. */
export const BOLD_MIN_AMOUNT_COP = 1000;
/** Tope de Bold con tarjeta. */
export const BOLD_MAX_CARD_COP = 5_000_000;
/** Tope de Bold con PSE (el más alto de los medios disponibles). */
export const BOLD_MAX_PSE_COP = 10_000_000;

export function isBoldConfigured(): boolean {
  return Boolean(process.env.BOLD_IDENTITY_KEY && process.env.BOLD_SECRET_KEY);
}

/** Llave de identidad: es la ÚNICA que puede viajar al navegador. */
export function boldIdentityKey(): string {
  return process.env.BOLD_IDENTITY_KEY ?? "";
}

function secretKey(): string {
  return process.env.BOLD_SECRET_KEY ?? "";
}

/**
 * ¿El total de una orden cabe en los topes de Bold? Fuera de rango el botón
 * no se ofrece (Bold rechazaría el cobro y el comprador vería un error sin
 * explicación).
 */
export function boldAmountSupported(totalCop: number): boolean {
  return (
    Number.isInteger(totalCop) &&
    totalCop >= BOLD_MIN_AMOUNT_COP &&
    totalCop <= BOLD_MAX_PSE_COP
  );
}

/**
 * Referencia (data-order-id) de una orden. Mismo prefijo que en Wompi para
 * que un pago sea reconocible de un vistazo en el panel de Bold. Bold exige
 * un identificador único de máximo 60 caracteres.
 *
 * `sufijo` permite reintentar un pago abandonado sin repetir el mismo
 * identificador en Bold; el código del pedido se sigue leyendo igual (ver
 * orderCodeFromBoldReference).
 */
export function boldOrderId(orderCode: string, sufijo?: string | number): string {
  const base = `DYS-${orderCode}`;
  const ref = sufijo ? `${base}-${sufijo}` : base;
  return ref.slice(0, 60);
}

/**
 * Código del pedido a partir de la referencia que devuelve Bold en
 * `metadata.reference`. Devuelve null si la referencia no es nuestra (por
 * ejemplo cobros hechos a mano desde el datáfono o el panel de Bold).
 *
 * Es deliberadamente tolerante: acepta `DYS-<código>`, `DYS-<código>-<n>` y
 * también el código pelado. Un pago cobrado que no encontráramos por una
 * tontería de formato sería mucho peor que buscar en la base un código que no
 * existe (eso simplemente no encuentra nada y se ignora).
 */
export function orderCodeFromBoldReference(reference: string): string | null {
  if (typeof reference !== "string") return null;
  const limpia = reference.trim();
  if (limpia.startsWith("DYS-")) {
    const code = limpia.slice(4).split("-")[0];
    return code.length > 0 ? code : null;
  }
  // Los códigos de pedido son 8 caracteres en mayúsculas y dígitos. Si algo
  // con esa pinta no existe en la base, simplemente no se encuentra la orden.
  return /^[A-Z0-9]{8}$/.test(limpia) ? limpia : null;
}

/**
 * Firma de integridad que exige Bold en el botón:
 *   SHA-256 hex de `{OrderId}{Amount}{Currency}{SecretKey}`.
 *
 * SIEMPRE se calcula aquí, en el servidor. La llave secreta jamás viaja al
 * navegador; lo que baja es solo este hash, que además ata el monto: si
 * alguien edita el `data-amount` en el HTML, la firma deja de cuadrar y Bold
 * rechaza la operación.
 */
export function boldIntegritySignature(params: {
  orderId: string;
  amount: number;
  currency?: string;
}): string {
  const currency = params.currency ?? "COP";
  return createHash("sha256")
    .update(`${params.orderId}${params.amount}${currency}${secretKey()}`)
    .digest("hex");
}

/** Atributos del <script data-bold-button ...> listos para el navegador. */
export type BoldButtonConfig = {
  apiKey: string;
  amount: number;
  currency: "COP";
  orderId: string;
  integritySignature: string;
  description: string;
  redirectionUrl: string;
  /** JSON serializado para data-customer-data (o undefined si no hay datos). */
  customerData?: string;
};

/** Descripción del cobro: Bold exige entre 2 y 100 caracteres. */
function sanearDescripcion(texto: string): string {
  const limpio = texto.replace(/\s+/g, " ").trim().slice(0, 100);
  return limpio.length >= 2 ? limpio : "Pago de pedido";
}

/**
 * Arma la configuración del botón para una orden.
 *
 * EL DINERO LO DECIDE EL SERVIDOR: `totalCop` tiene que salir SIEMPRE del
 * `total` de la orden guardada en la base, nunca de un parámetro del
 * navegador. Aquí se firma ese monto, así que un total inventado se
 * cobraría de verdad: no hay más red que llamar bien a esta función.
 */
export function boldButtonConfig(params: {
  orderCode: string;
  /** `order.total` en pesos enteros. */
  totalCop: number;
  redirectUrl: string;
  description: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  /** Sufijo opcional para reintentos (ver boldOrderId). */
  sufijoReferencia?: string | number;
}): BoldButtonConfig {
  const orderId = boldOrderId(params.orderCode, params.sufijoReferencia);
  const amount = Math.round(params.totalCop);
  const customer: Record<string, string> = {};
  if (params.customerEmail) customer.email = params.customerEmail;
  if (params.customerName) customer.fullName = params.customerName;
  if (params.customerPhone) customer.phone = params.customerPhone;

  return {
    apiKey: boldIdentityKey(),
    amount,
    currency: "COP",
    orderId,
    integritySignature: boldIntegritySignature({ orderId, amount, currency: "COP" }),
    description: sanearDescripcion(params.description),
    redirectionUrl: params.redirectUrl,
    customerData:
      Object.keys(customer).length > 0 ? JSON.stringify(customer) : undefined,
  };
}

// ── Webhook ──────────────────────────────────────────────────────────

export type BoldWebhookEvent = {
  id?: string;
  type: string; // SALE_APPROVED | SALE_REJECTED | VOID_APPROVED | VOID_REJECTED
  subject?: string;
  source?: string;
  time?: number;
  data?: {
    payment_id?: string;
    merchant_id?: string;
    created_at?: string;
    amount?: {
      currency?: string;
      /** Total cobrado EN PESOS (Bold no usa centavos). */
      total?: number;
      taxes?: unknown[];
      tip?: number;
    };
    metadata?: { reference?: string };
    payer_email?: string;
    payment_method?: string;
    bold_code?: string;
  };
};

/**
 * ¿Se admite la firma de PRUEBAS (llave secreta = cadena vacía)?
 *
 * En el ambiente de pruebas Bold firma los webhooks con la cadena vacía. Eso
 * es cómodo para probar y un agujero enorme si se cuela a producción:
 * cualquiera podría firmar un "pago aprobado". Por eso hacen falta DOS
 * condiciones y una de ellas no depende de nadie: en un despliegue de
 * producción (NODE_ENV=production) nunca se acepta, ponga lo que ponga
 * BOLD_ENV.
 */
function admiteFirmaDePruebas(): boolean {
  return (
    process.env.BOLD_ENV === "test" && process.env.NODE_ENV !== "production"
  );
}

/** Comparación en tiempo constante de dos hex (no filtra por latencia). */
function igualEnTiempoConstante(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  // timingSafeEqual revienta si las longitudes difieren: se comprueba antes.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verifica la firma del webhook de Bold.
 *
 * Receta de Bold: se codifica el CUERPO CRUDO en Base64 y a ese texto se le
 * aplica HMAC-SHA256 con la llave secreta; el resultado va en hexadecimal en
 * la cabecera `x-bold-signature`. Por eso el route handler tiene que leer el
 * cuerpo con req.text() y no con req.json(): reserializar el JSON cambiaría
 * un espacio y tumbaría la firma.
 */
export function verifyBoldWebhook(
  rawBody: string,
  firmaCabecera: string | null | undefined
): boolean {
  const firma = (firmaCabecera ?? "").trim().toLowerCase();
  if (!firma) return false;

  const enBase64 = Buffer.from(rawBody, "utf8").toString("base64");
  const candidatas = [secretKey()];
  if (admiteFirmaDePruebas()) candidatas.push("");

  let valida = false;
  for (const secreto of candidatas) {
    if (secreto === "" && !admiteFirmaDePruebas()) continue;
    const esperada = createHmac("sha256", secreto)
      .update(enBase64)
      .digest("hex");
    // Sin cortes tempranos: se recorren todas las candidatas siempre.
    if (igualEnTiempoConstante(esperada, firma)) valida = true;
  }
  return valida;
}

/**
 * Verifica que el pago corresponda REALMENTE a la orden: moneda COP y monto
 * EXACTO. Sin esto, cualquiera podría pagar $1.000 con la referencia de un
 * pedido de $200.000 y disparar la confirmación.
 *
 * Se compara `data.amount.total`, que es lo efectivamente cobrado en PESOS
 * (Bold no usa centavos). Los impuestos (`taxes`) y la propina (`tip`) vienen
 * desglosados aparte pero ya están DENTRO de `total`; nuestro botón no
 * habilita propina, así que `total` tiene que ser el total del pedido, ni un
 * peso más ni uno menos. Si algún día se activara la propina en el comercio,
 * estos pagos caerían aquí como "monto no coincide" y quedarían para gestión
 * manual: preferimos revisar a mano antes que confirmar a ciegas.
 */
export function boldTransactionMatchesOrder(
  evento: BoldWebhookEvent,
  order: { total: number }
): boolean {
  const amount = evento?.data?.amount;
  if (!amount) return false;
  if (amount.currency !== "COP") return false;
  if (typeof amount.total !== "number" || !Number.isFinite(amount.total)) {
    return false;
  }
  return amount.total === order.total;
}

// Nota deliberada: Bold NO documenta una consulta pública "dame el estado de
// la referencia X" equivalente al /transactions?reference= de Wompi, así que
// aquí no hay un fetchTransaction(). El webhook firmado es la vía de
// confirmación; inventarse un endpoint sería peor que no tenerlo.
