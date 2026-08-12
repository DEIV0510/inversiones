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
 * Acepta "310 693 0187", "3106930187", "573106930187" o con cero troncal.
 * Devuelve null ante entradas ambiguas (probable error de digitación) para
 * no publicar enlaces wa.me rotos o hacia otro país.
 */
export function normalizeWhatsApp(input: string): string | null {
  // wa.me rechaza ceros iniciales (formato troncal): se eliminan.
  const digits = input.replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  if (digits.length === 12 && digits.startsWith("57")) return digits;
  // 11 dígitos empezando por 3 = celular colombiano con un dígito de más o
  // de menos: rechazar en vez de interpretarlo como otro país (31 = Países
  // Bajos).
  if (digits.length === 11 && digits.startsWith("3")) return null;
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}
