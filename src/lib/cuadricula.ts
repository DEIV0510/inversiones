import { digitsForTotal } from "./numbers";

/**
 * Rifas de CUADRÍCULA: las "normales" de 2 y 3 cifras (00-99 / 000-999).
 *
 * La página enseña TODOS los números en orden, cada uno con su estado:
 *   · libre      → blanco, se puede tocar;
 *   · reservado  → amarillo: alguien lo apartó y falta que pague;
 *   · pagado     → verde: el dueño ya confirmó el pago;
 *   · bloqueado  → gris: el dueño lo sacó de la venta.
 * El comprador escoge los suyos, pulsa RESERVAR, deja su nombre y el pedido le
 * llega al dueño por WhatsApp con los números a la vista.
 *
 * Este archivo NO toca la base de datos: lo usan a la vez el servidor, el
 * panel y el navegador del comprador, así que las reglas son una sola.
 */

/**
 * Tope de números de una rifa de cuadrícula. Más allá de 1.000 el tablero
 * deja de leerse en un celular y, sobre todo, la rifa grande de 10.000 nunca
 * puede publicar su inventario entero: esa regla la sostiene este tope.
 */
export const MAX_NUMEROS_CUADRICULA = 1000;

export type EstadoCasilla = "libre" | "reservado" | "pagado" | "bloqueado";

/**
 * El tablero viaja como una cadena de un carácter por número (posición =
 * número): 100 números son 100 bytes y 1.000 son 1 KB. Nada de nombres, ni
 * teléfonos, ni códigos de pedido: solo el estado de cada casilla.
 */
const CODIGO: Record<EstadoCasilla, string> = {
  libre: "0",
  reservado: "1",
  pagado: "2",
  bloqueado: "3",
};

const ESTADO_POR_CODIGO: Record<string, EstadoCasilla> = {
  "0": "libre",
  "1": "reservado",
  "2": "pagado",
  "3": "bloqueado",
};

export function codigoDeEstado(estado: EstadoCasilla): string {
  return CODIGO[estado];
}

/** Estado de un número dentro del tablero. Fuera de rango = libre. */
export function leerCasilla(tablero: string, numero: number): EstadoCasilla {
  return ESTADO_POR_CODIGO[tablero.charAt(numero)] ?? "libre";
}

/** ¿El tablero que llegó del servidor tiene la forma esperada? */
export function tableroValido(tablero: unknown, total: number): tablero is string {
  return (
    typeof tablero === "string" &&
    tablero.length === total &&
    /^[0-3]*$/.test(tablero)
  );
}

/**
 * Cifras que le tocan a una rifa de cuadrícula según cuántos números tiene:
 * hasta 100 → 2 cifras (00-99); hasta 1.000 → 3 cifras (000-999). Nunca
 * menos de 2, que es lo mínimo que acepta el panel.
 */
export function cifrasDeCuadricula(totalNumbers: number): number {
  return Math.max(2, digitsForTotal(totalNumbers));
}

/**
 * Coherencia de una rifa de cuadrícula, comprobada en el SERVIDOR al crear y
 * al editar (y repetida en el panel para avisar antes). Devuelve el mensaje
 * para el dueño, o null si todo cuadra.
 *
 * Las cifras tienen que ser las justas: con 100 números y 4 cifras la rifa
 * saldría 0000-0099, que no es una rifa de dos cifras aunque tenga 100.
 */
export function errorCuadricula(rifa: {
  boardMode: boolean;
  totalNumbers: number;
  digits: number;
}): string | null {
  if (!rifa.boardMode) return null;
  if (rifa.totalNumbers > MAX_NUMEROS_CUADRICULA) {
    return "Una rifa de cuadrícula admite máximo 1.000 números (del 000 al 999).";
  }
  const cifras = cifrasDeCuadricula(rifa.totalNumbers);
  if (rifa.digits !== cifras) {
    return `Con ${rifa.totalNumbers} números la rifa de cuadrícula es de ${cifras} cifras (del ${"0".repeat(cifras)} al ${String(rifa.totalNumbers - 1).padStart(cifras, "0")}).`;
  }
  return null;
}

/**
 * Lo que una rifa de cuadrícula fuerza SIEMPRE, mande lo que mande el panel:
 *   · el comprador escoge sus números (nada de "al azar": con números
 *     asignados por el sistema, ponerlos en el mensaje de WhatsApp los
 *     revelaría antes de pagar);
 *   · el pedido sale por WhatsApp;
 *   · sin pasarela: el dueño cobra por Nequi o transferencia y marca el pago a
 *     mano. Con la pasarela encendida la pantalla del pedido NO saltaría a
 *     WhatsApp y el comprador vería un botón de pago que no pidió nadie.
 */
export const AJUSTES_FORZADOS_CUADRICULA = {
  selectionMode: "MANUAL",
  whatsappCheckout: true,
  gatewayCheckout: false,
} as const;

/**
 * Texto de la lista de números para el mensaje de WhatsApp y la pantalla:
 * "07, 23, 58". Los números ya vienen formateados con sus ceros.
 */
export function listaDeNumeros(numeros: string[]): string {
  return numeros.join(", ");
}
