import { formatCop } from "./format";
import { waLink } from "./whatsapp";

/**
 * Arquitectura de notificaciones. Hoy el canal operativo es WhatsApp por
 * enlaces dinámicos (el negocio atiende manualmente). La interfaz Provider
 * deja listo el enganche de canales automáticos (WhatsApp Business API,
 * email con Resend, SMS) sin tocar el resto del sistema — ver docs/.
 */

export type NotificationEvent =
  | "order.created"
  | "order.paid"
  | "order.expiring"
  | "order.expired"
  | "payment.rejected"
  | "winner.published";

export type NotificationPayload = {
  participantName?: string;
  participantPhone?: string;
  raffleTitle?: string;
  orderCode?: string;
  numbers?: string[];
  total?: number;
};

export interface NotificationProvider {
  send(event: NotificationEvent, payload: NotificationPayload): Promise<void>;
}

const providers: NotificationProvider[] = [
  // Registrar aquí providers automáticos cuando existan credenciales:
  // new WhatsAppBusinessProvider(), new ResendEmailProvider(), ...
];

export async function notify(
  event: NotificationEvent,
  payload: NotificationPayload
): Promise<void> {
  await Promise.allSettled(providers.map((p) => p.send(event, payload)));
}

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
}): string {
  const boletas =
    params.quantity === 1 ? "1 número" : `${params.quantity} números`;
  const message =
    `Hola, soy ${params.participantName}. Acabo de comprar en el sorteo ` +
    `${params.raffleTitle}.\n` +
    `Pedido ${params.orderCode} - ${boletas} - ${formatCop(params.total)}\n` +
    `Quiero coordinar el pago.`;
  return waLink(params.businessPhone, message);
}
