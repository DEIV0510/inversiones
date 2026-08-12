import type { SiteSettings } from "./settings";

export type FaqItem = { question: string; answer: string };

export function getFaqItems(settings: SiteSettings): FaqItem[] {
  return [
    {
      question: "¿Cómo puedo participar?",
      answer: `Elige el sorteo que te interesa y escríbenos por WhatsApp con el botón "Quiero participar". Te daremos personalmente las instrucciones para completar tu participación.`,
    },
    {
      question: "¿Qué sorteos están disponibles?",
      answer:
        "En la sección de sorteos activos encuentras los sorteos vigentes con su premio, precio, fecha y porcentaje de avance.",
    },
    {
      question: "¿Qué premios puedo ganar?",
      answer:
        "Actualmente realizamos sorteos de dinero en efectivo y motocicletas. Más adelante incorporaremos nuevos premios.",
    },
    {
      question: "¿Cómo conozco los resultados?",
      answer:
        "Los resultados se anuncian por nuestros canales oficiales y se publican en la sección de ganadores de esta página.",
    },
    {
      question: "¿Cómo me contacto?",
      answer: `Por WhatsApp al ${settings.whatsapp_display}. Puedes usar el botón flotante o cualquier botón "Quiero participar" de esta página.`,
    },
    {
      question: "¿Dónde están ubicados?",
      answer: `Estamos en ${settings.location}. Toda la atención se realiza directamente por WhatsApp.`,
    },
    {
      question: "¿Qué ocurre después de participar?",
      answer:
        "Recibirás por WhatsApp la confirmación de tu participación y las indicaciones del sorteo. Luego solo debes estar atento a la fecha y al anuncio de resultados.",
    },
    {
      question: "¿Dónde puedo consultar las condiciones?",
      answer:
        "En los enlaces de términos y condiciones de esta página. Además, por WhatsApp te compartimos las condiciones del sorteo que te interese antes de participar.",
    },
  ];
}
