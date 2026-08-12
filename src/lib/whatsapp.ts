export function waLink(number: string, message: string): string {
  const digits = number.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function waParticipate(number: string, raffleTitle: string): string {
  return waLink(number, `Hola, quiero participar en el sorteo ${raffleTitle}.`);
}

export function waConsult(number: string, raffleTitle: string): string {
  return waLink(number, `Hola, quiero más información sobre el sorteo ${raffleTitle}.`);
}

export function waGeneral(number: string): string {
  return waLink(
    number,
    "Hola, quiero conocer los sorteos disponibles de Inversiones D y S."
  );
}

/**
 * Normaliza un número de WhatsApp colombiano a formato internacional (57...).
 * Acepta "310 693 0187", "3106930187" o "573106930187".
 */
export function normalizeWhatsApp(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  if (digits.length === 12 && digits.startsWith("57")) return digits;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}
