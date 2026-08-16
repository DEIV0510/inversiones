import type { SiteSettings } from "./settings";

export type FaqItem = { question: string; answer: string };

export function getFaqItems(settings: SiteSettings): FaqItem[] {
  return [
    {
      question: "¿Cómo participo?",
      answer:
        "Elige el sorteo, selecciona tus números (o deja que el sistema los elija al azar), completa tus datos y realiza el pago. Recibirás un comprobante con tu código de participación.",
    },
    {
      question: "¿Cómo selecciono mis números?",
      answer:
        "En la página del sorteo puedes buscar tu número de la suerte y verificar si está disponible, elegir entre los números sugeridos, o pedir números al azar. Tú decides.",
    },
    {
      question: "¿Cómo funciona la reserva?",
      answer:
        "Al continuar, tus números quedan reservados durante unos minutos mientras completas el pago. Si el tiempo se agota, los números vuelven a estar disponibles para otras personas.",
    },
    {
      question: "¿Cómo realizo el pago?",
      answer:
        "Puedes pagar en línea (cuando la pasarela está habilitada) o coordinar el pago directamente por WhatsApp. Tu participación queda confirmada cuando verificamos el pago.",
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
        "El resultado se anuncia por nuestros canales oficiales y el ganador queda publicado en la sección de ganadores de esta página.",
    },
    {
      question: "¿Dónde puedo consultar las condiciones?",
      answer:
        "Cada sorteo tiene sus condiciones en su propia página, y las condiciones generales están en el enlace de términos de esta página.",
    },
  ];
}
