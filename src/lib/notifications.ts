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

/** Mensaje de WhatsApp hacia el NEGOCIO para coordinar el pago de una orden. */
export function orderWhatsAppMessage(params: {
  businessPhone: string;
  participantName: string;
  raffleTitle: string;
  orderCode: string;
  numbers: string[];
  total: number;
}): string {
  const message =
    `Hola, soy ${params.participantName}. Acabo de reservar en el sorteo ` +
    `${params.raffleTitle}.\n` +
    `Orden: ${params.orderCode}\n` +
    `Números: ${params.numbers.join(", ")}\n` +
    `Total: ${formatCop(params.total)}\n` +
    `Quiero coordinar el pago.`;
  return waLink(params.businessPhone, message);
}
