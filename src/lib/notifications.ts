import { listaDeNumeros } from "./cuadricula";
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

/**
 * Mensaje de WhatsApp de una RESERVA en una rifa de cuadrícula.
 *
 * A diferencia del de arriba, este SÍ lleva los números, y es a propósito: en
 * la cuadrícula el comprador los escogió él mismo sobre un tablero público
 * (nada que revelar) y es justo lo que el dueño necesita ver para apuntarlos
 * en su tabla. El servidor rechaza los pedidos "al azar" en estas rifas, así
 * que aquí nunca llega un número que el comprador no haya elegido.
 *
 * Lleva también el código: con él el dueño encuentra la reserva en el panel
 * para marcarla pagada, y es la única forma que tiene de volver a su reserva
 * quien la hizo solo con el nombre.
 */
export function reservaWhatsAppMessage(params: {
  businessPhone: string;
  participantName: string;
  raffleTitle: string;
  orderCode: string;
  /** Números ya formateados con sus ceros ("07", "023"). */
  numbers: string[];
  total: number;
  /** El dueño ya confirmó el pago. */
  pagada?: boolean;
}): string {
  const cuantos = params.numbers.length;
  const numeros = listaDeNumeros(params.numbers);
  const message = params.pagada
    ? `Hola, soy ${params.participantName}. Mi pago del sorteo ` +
      `${params.raffleTitle} ya está confirmado.\n` +
      `${cuantos === 1 ? "Mi número" : "Mis números"}: ${numeros}\n` +
      `Código: ${params.orderCode}`
    : `Hola, soy ${params.participantName}. Quiero reservar en el sorteo ` +
      `${params.raffleTitle} ${cuantos === 1 ? "el número" : "los números"}: ` +
      `${numeros}\n` +
      `Valor total: ${formatCop(params.total)}\n` +
      `Código de reserva: ${params.orderCode}`;
  return waLink(params.businessPhone, message);
}
