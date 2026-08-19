import type { SiteSettings } from "./settings";

export type FaqItem = { question: string; answer: string };

/**
 * Preguntas frecuentes de la portada. Tienen que decir lo MISMO que las
 * pantallas de compra, así que aquí se respetan las mismas reglas:
 *
 *  - al comprador no se le nombra "manual" ni "aleatorio": elige cuántos
 *    números quiere o busca el suyo;
 *  - no se habla de "reserva": los números se le guardan un rato mientras
 *    paga, que es lo que dice el checkout;
 *  - ningún medio de pago se promete por nombre, porque cada rifa decide si
 *    cobra por WhatsApp y esta portada es común a todas.
 */
export function getFaqItems(settings: SiteSettings): FaqItem[] {
  return [
    {
      question: "¿Cómo participo?",
      answer:
        "Elige el sorteo, escoge cuántos números quieres (o busca el tuyo), completa tus datos y realiza el pago. Recibirás un comprobante con tu código de participación.",
    },
    {
      question: "¿Cómo selecciono mis números?",
      answer:
        "En la página del sorteo puedes tocar directamente la cantidad que quieras comprar, elegir entre los números sugeridos o buscar tu número de la suerte y verificar si está disponible. Tú decides.",
    },
    {
      question: "¿Qué pasa con mis números mientras pago?",
      answer:
        "Al continuar te guardamos tus números a tu nombre durante el tiempo que indica ese sorteo, mientras completas el pago. Si el tiempo se agota, vuelven a quedar disponibles para otras personas.",
    },
    {
      question: "¿Cuándo veo mis números?",
      answer:
        "Tus números se muestran cuando confirmamos tu pago. Antes de eso ves cuántos tienes guardados, tu total y tu código de participación, pero los números siguen tapados: así nadie puede quedarse con ellos sin haber pagado.",
    },
    {
      question: "¿Cómo realizo el pago?",
      answer:
        "Al terminar tu compra, la pantalla de tu pedido te muestra las formas de pago de ese sorteo. Tu participación queda confirmada cuando verificamos el pago.",
    },
    {
      question: "¿Dónde consulto mis números?",
      answer: `En la sección "Mis boletas" basta con un dato: tu celular, tu correo, tu cédula o el código de participación de tu compra. También puedes escribirnos al ${settings.whatsapp_display}.`,
    },
    {
      question: "¿Cuándo se realiza el sorteo?",
      answer:
        "Cada sorteo muestra su fecha en la página. Cualquier cambio se anuncia por nuestros canales oficiales.",
    },
    {
      question: "¿Cómo se publica el ganador?",
      answer:
        "El resultado se anuncia por nuestros canales oficiales y el ganador queda publicado en la sección de ganadores de esta página. El día del sorteo también puedes escribir el número que salió en \"Consultar número ganador\" y ver a quién le pertenece.",
    },
    {
      question: "¿Dónde puedo consultar las condiciones?",
      answer:
        "Cada sorteo tiene sus condiciones en su propia página, y las condiciones generales están en el enlace de términos de esta página.",
    },
  ];
}
