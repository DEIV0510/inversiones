const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

export function formatCop(value: number): string {
  return copFormatter.format(value);
}

/**
 * Plazo en minutos escrito como lo diría una persona.
 *
 * `reservationMinutes` se configura por rifa y en las que cobran por WhatsApp
 * está en 720, porque el dueño tiene que ver el mensaje, mandar los datos de
 * la cuenta y esperar el comprobante. El problema era que la pantalla de
 * compra lo escupía tal cual: "Te guardamos tus números 720 minutos". Nadie
 * cuenta así. Con esto se lee "12 horas".
 *
 *   45  → "45 minutos"      1  → "1 minuto"
 *   720 → "12 horas"        60 → "1 hora"
 *   90  → "1 hora y 30 minutos"
 */
export function formatearPlazo(minutos: number): string {
  const total = Math.max(0, Math.round(minutos));
  if (total < 60) return total === 1 ? "1 minuto" : `${total} minutos`;

  const horas = Math.floor(total / 60);
  const resto = total % 60;
  const textoHoras = horas === 1 ? "1 hora" : `${horas} horas`;
  if (resto === 0) return textoHoras;
  const textoMin = resto === 1 ? "1 minuto" : `${resto} minutos`;
  return `${textoHoras} y ${textoMin}`;
}
