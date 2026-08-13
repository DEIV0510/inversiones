// Utilidades puras del sistema de números (sin dependencias de servidor).

/** Formatea un número según los dígitos de la rifa: (42, 5) → "00042". */
export function formatNumber(value: number, digits: number): string {
  return String(value).padStart(digits, "0");
}

export function formatNumbers(values: number[], digits: number): string[] {
  return values.map((v) => formatNumber(v, digits));
}

/** Parsea la entrada del usuario ("00042", "42") → 42, o null si no es válida. */
export function parseNumberInput(input: string, totalNumbers: number): number | null {
  const clean = input.trim();
  if (!/^\d{1,7}$/.test(clean)) return null;
  const value = parseInt(clean, 10);
  if (!Number.isInteger(value) || value < 0 || value >= totalNumbers) return null;
  return value;
}

/** Dígitos necesarios para una cantidad total: 10000 → 4, 100000 → 5. */
export function digitsForTotal(totalNumbers: number): number {
  return Math.max(1, String(totalNumbers - 1).length);
}

/** Valida una lista de números elegidos por el usuario. */
export function validateSelection(
  numbers: number[],
  totalNumbers: number,
  maxPerOrder: number
): string | null {
  if (numbers.length === 0) return "Selecciona al menos un número";
  if (numbers.length > maxPerOrder)
    return `Máximo ${maxPerOrder} números por pedido`;
  const seen = new Set<number>();
  for (const n of numbers) {
    if (!Number.isInteger(n) || n < 0 || n >= totalNumbers)
      return "Número fuera de rango";
    if (seen.has(n)) return "Hay números repetidos en la selección";
    seen.add(n);
  }
  return null;
}
