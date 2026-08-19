import { formatCop } from "./format";
import { waLink } from "./whatsapp";

/**
 * Avisos hacia el comprador y hacia el negocio.
 *
 * Aquí vivía además un armazón de "providers" genérico (interfaz
 * NotificationProvider + notify()) con la lista de providers VACÍA: nadie lo
 * llamaba nunca y el correo acabó implementándose aparte, en `src/lib/email.ts`,
 * con su propia llamada directa desde el motor de pagos. Se retiró para que no
 * quede un segundo camino de notificaciones que en realidad no notifica nada.
 */

/**
 * Mensaje de WhatsApp hacia el NEGOCIO para coordinar el pago de una orden.
 *
 * A propósito NO lleva los números: este texto se abre dentro del WhatsApp
 * del comprador, así que los podría leer (y capturar) antes de pagar. Va el
 * CÓDIGO de participación, la cantidad y el total; con ese código el dueño
 * ve los números en el panel.
 */
export function orderWhatsAppMessage(params: {
  businessPhone: string;
  participantName: string;
  raffleTitle: string;
  orderCode: string;
  quantity: number;
  total: number;
  /**
   * Pago ya confirmado. El mismo botón de WhatsApp sigue en la pantalla del
   * pedido DESPUÉS de pagar —y es justo el que la página le señala al ganador
   * de un premio instantáneo para reclamarlo—, así que abrirlo con un "Quiero
   * coordinar el pago" le hacía escribirle al dueño para pagar algo que ya
   * pagó. El texto de los números sigue sin viajar aquí: solo el código.
   */
  pagada?: boolean;
  /** Premios instantáneos que ganó ESTE pedido, ya pagado. */
  premios?: { number: string; prize: string }[];
}): string {
  const boletas =
    params.quantity === 1 ? "1 número" : `${params.quantity} números`;
  const premios = params.pagada ? (params.premios ?? []) : [];
  const cierre = !params.pagada
    ? "Quiero coordinar el pago."
    : premios.length > 0
      ? `Mi pago ya está confirmado y ${
          premios.length === 1 ? "gané un premio" : "gané premios"
        }: ${premios
          .map((p) => `${p.number} (${p.prize})`)
          .join(", ")}. Quiero reclamarlo.`
      : "Mi pago ya está confirmado. Escribo para dejar constancia de mi participación.";
  const message =
    `Hola, soy ${params.participantName}. Acabo de comprar en el sorteo ` +
    `${params.raffleTitle}.\n` +
    `Pedido ${params.orderCode} - ${boletas} - ${formatCop(params.total)}\n` +
    cierre;
  return waLink(params.businessPhone, message);
}
