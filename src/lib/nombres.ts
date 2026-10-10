/**
 * BUSCAR POR NOMBRE en «Mis boletas». En las rifas de 2 y 3 cifras se puede
 * reservar solo con el nombre, así que el nombre es el único dato que ese
 * comprador tiene para volver a encontrar sus números.
 *
 * El nombre se guarda tal cual lo escribió la persona ("Juan Pérez",
 * "juan perez", "JUAN  PÉREZ"), así que la comparación se hace sobre una forma
 * normalizada: sin tildes, en minúsculas y palabra por palabra. Nada de "que
 * contenga": "Ana" no encuentra a "Mariana" ni "Juan" a "Juana".
 *
 * Archivo puro (sin base de datos) para poder probarlo sin servidor.
 */

/**
 * Conectores que no identifican a nadie: "María de los Ángeles" se compara
 * por "maria" y "angeles". Si contaran, buscar "de la" encontraría a media
 * lista.
 */
const CONECTORES = new Set(["de", "del", "la", "las", "los", "y", "e"]);

/**
 * Palabras de un nombre listas para comparar: sin tildes ni diéresis (la ñ
 * queda como n, así "Muñoz" y "Munoz" son el mismo), en minúsculas, sin
 * signos y sin conectores.
 */
export function palabrasDeNombre(nombre: string): string[] {
  return nombre
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((p) => p !== "" && !CONECTORES.has(p));
}

/**
 * ¿El texto escrito puede ser un nombre? Sin arroba (eso es un correo), sin
 * cifras (eso es celular, cédula o código) y con al menos una palabra de tres
 * letras o más: con "Al" o "Li" saldría cualquiera.
 */
export function pareceNombre(texto: string): boolean {
  if (texto.includes("@") || /\d/.test(texto)) return false;
  return palabrasDeNombre(texto).some((p) => p.length >= 3);
}

/**
 * ¿La búsqueda corresponde a este nombre guardado? Todas las palabras del más
 * corto de los dos tienen que estar en el otro. Así sirve en los dos sentidos:
 *   - reservó "Juan Pérez" y busca "juan perez" o "Pérez Juan": sí;
 *   - reservó "Juan Pérez Gómez" y busca "Juan Pérez": sí;
 *   - reservó solo "Juan" y busca "Juan Pérez": sí (ese "Juan" puede ser él);
 *   - reservó "Juan Pérez" y busca "Juan Gómez": no.
 */
export function coincideNombre(busqueda: string, guardado: string): boolean {
  const a = palabrasDeNombre(busqueda);
  const b = palabrasDeNombre(guardado);
  if (a.length === 0 || b.length === 0) return false;
  const [corto, largo] = a.length <= b.length ? [a, b] : [b, a];
  const enLargo = new Set(largo);
  return corto.every((p) => enLargo.has(p));
}

/** Mismo nombre escrito de otra forma ("JUAN PÉREZ" = "juan perez"). */
export function mismoNombre(a: string, b: string): boolean {
  return palabrasDeNombre(a).join(" ") === palabrasDeNombre(b).join(" ");
}
